package com.rattil.quran

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import java.io.File

/**
 * غلاف أندرويد لتطبيق «رتّل»: WebView للموقع المنشور (فيتحدّث مع كل نشر ويعمل بدون إنترنت عبر الـ Service Worker)،
 * مع جسر RattilNative لجدولة الأذان والورد محليًا، وحفظ الملفات، واختيار الملفات، والموقع.
 */
class MainActivity : ComponentActivity() {
    companion object {
        const val BASE = "https://mohamedmostafay08-gif.github.io/quran-app-sadaqa/"
        const val EXTRA_HASH = "hash"
    }

    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var geoCallback: Pair<String, GeolocationPermissions.Callback>? = null
    private var customView: View? = null
    private var pendingSave: Pair<String, ByteArray>? = null

    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        fileCallback = null
    }
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) { maybeAskExact() }
    private val askLocation = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        geoCallback?.let { (origin, cb) -> cb.invoke(origin, ok, false) }
        geoCallback = null
    }
    private val createDoc = registerForActivityResult(ActivityResultContracts.CreateDocument("*/*")) { uri ->
        val p = pendingSave; pendingSave = null
        if (uri != null && p != null) {
            contentResolver.openOutputStream(uri)?.use { it.write(p.second) }
            Toast.makeText(this, "تم الحفظ", Toast.LENGTH_SHORT).show()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Notifier.channels(this)
        web = WebView(this)
        setContentView(web)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false // الأذان عند فتح الإشعار
            setGeolocationEnabled(true)
            allowFileAccess = false
            userAgentString = "$userAgentString RattilAndroid/1.0"
        }
        web.addJavascriptInterface(Bridge(), "RattilNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val url = req.url
                if (!req.isForMainFrame) return false
                if (url.toString().startsWith(BASE)) return false
                // الروابط الخارجية (يوتيوب، واتساب، البريد…) تفتح في تطبيقاتها
                try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: ActivityNotFoundException) {}
                return true
            }
        }
        val chrome = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = cb
                return try { pickFile.launch(params.createIntent()); true } catch (_: ActivityNotFoundException) { fileCallback = null; false }
            }
            override fun onGeolocationPermissionsShowPrompt(origin: String, cb: GeolocationPermissions.Callback) {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) cb.invoke(origin, true, false)
                else { geoCallback = origin to cb; askLocation.launch(Manifest.permission.ACCESS_COARSE_LOCATION) }
            }
            // الفيديو بملء الشاشة (دروس يوتيوب)
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                customView = view
                (window.decorView as ViewGroup).addView(view, FrameLayout.LayoutParams(-1, -1))
            }
            override fun onHideCustomView() {
                (window.decorView as ViewGroup).removeView(customView); customView = null
            }
        }
        web.webChromeClient = chrome
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    customView != null -> chrome.onHideCustomView()
                    web.canGoBack() -> web.goBack()
                    else -> { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
                }
            }
        })
        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl(BASE + (intent.getStringExtra(EXTRA_HASH) ?: ""))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val hash = intent.getStringExtra(EXTRA_HASH) ?: return
        // التطبيق مفتوح: نطلب من الصفحة الانتقال (وتشغيل الأذان إن طُلب) دون إعادة تحميل
        val js = "window.dispatchEvent(new CustomEvent('rattil-open',{detail:${org.json.JSONObject.quote(hash)}}))"
        web.evaluateJavascript(js, null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    private fun maybeAskNotify() {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else maybeAskExact()
    }

    /** أندرويد ١٢+: إذن «المنبّهات والتذكيرات» ليصل الأذان في الدقيقة نفسها (يُطلب مرة واحدة) */
    private fun maybeAskExact() {
        if (Build.VERSION.SDK_INT < 31 || Scheduler.canExact(this)) return
        val prefs = getSharedPreferences("rattil", MODE_PRIVATE)
        if (prefs.getBoolean("askedExact", false)) return
        prefs.edit().putBoolean("askedExact", true).apply()
        AlertDialog.Builder(this)
            .setTitle("الأذان في موعده بالضبط")
            .setMessage("اسمح لـ«رتّل» بضبط المنبّهات حتى يصل إشعار الأذان في دقيقته دون تأخير.")
            .setPositiveButton("السماح") { _, _ -> startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$packageName"))) }
            .setNegativeButton("لاحقًا", null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        Scheduler.reschedule(this) // بعد منح إذن المنبّهات الدقيقة
    }

    private fun saveFile(name: String, mime: String, bytes: ByteArray) {
        if (Build.VERSION.SDK_INT >= 29) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + "Rattil")
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            if (uri != null) {
                contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
                Toast.makeText(this, "حُفظ في التنزيلات/Rattil: $name", Toast.LENGTH_LONG).show()
                return
            }
        }
        // أندرويد ٩ وما قبله: المستخدم يختار مكان الحفظ (بلا أذونات تخزين)
        pendingSave = name to bytes
        createDoc.launch(name)
    }

    inner class Bridge {
        @JavascriptInterface
        fun setSchedule(json: String) {
            Scheduler.save(applicationContext, json)
            val s = Schedule.parse(json)
            if (s != null && (s.prayers.isNotEmpty() || s.wirdTime != null)) runOnUiThread { maybeAskNotify() }
        }

        @JavascriptInterface
        fun saveFile(name: String, mime: String, base64: String) {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(120).ifEmpty { "rattil" }
            runOnUiThread { saveFile(safe, mime, bytes) }
        }

        @JavascriptInterface
        fun testNotification() = runOnUiThread {
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) maybeAskNotify()
            else Notifier.test(applicationContext)
        }

        @JavascriptInterface
        fun version(): String = BuildConfig.VERSION_NAME
    }
}
