package com.rattil.quran

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object Notifier {
    private const val CH_ADHAN = "adhan"
    private const val CH_REMIND = "reminders"

    fun channels(ctx: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = ctx.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CH_ADHAN, "الأذان", NotificationManager.IMPORTANCE_HIGH).apply { description = "إشعار عند دخول وقت الصلاة" })
        nm.createNotificationChannel(NotificationChannel(CH_REMIND, "التذكيرات", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "قبل الأذان، والورد اليومي" })
    }

    /** يفتح التطبيق على مسار داخلي (مثل #/prayer?adhan=fajr) */
    fun openApp(ctx: Context, hash: String, code: Int): PendingIntent =
        PendingIntent.getActivity(
            ctx, code,
            Intent(ctx, MainActivity::class.java).putExtra(MainActivity.EXTRA_HASH, hash).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun show(ctx: Context, e: Events.Event, preAdhan: Int) {
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        channels(ctx)
        val name = Events.NAMES[e.prayer] ?: ""
        val (channel, title, body, hash) = when (e.kind) {
            Events.Kind.ADHAN -> Quad(CH_ADHAN, "حان الآن موعد صلاة $name", "«حيّ على الصلاة، حيّ على الفلاح» — اضغط لسماع الأذان", "#/prayer?adhan=${e.prayer}")
            Events.Kind.PRE -> Quad(CH_REMIND, "باقي ${Format.digits(preAdhan)} دقيقة على صلاة $name", "استعد للصلاة، وتوضأ إن لم تكن على وضوء.", "#/prayer")
            Events.Kind.WIRD -> Quad(CH_REMIND, "موعد وردك اليومي", "خصّص دقائق للقرآن الآن، ولو صفحة واحدة.", "#/khatma")
            Events.Kind.STALE -> Quad(CH_REMIND, "افتح «رتّل» لتحديث مواقيت الصلاة", "حتى يستمر الأذان في موعده الأيام القادمة.", "#/prayer")
        }
        val id = (e.kind.ordinal * 10) + (Events.PRAYERS.indexOf(e.prayer) + 1)
        val n = NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(if (e.kind == Events.Kind.ADHAN) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
            .setPriority(if (e.kind == Events.Kind.ADHAN) NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(openApp(ctx, hash, id))
            .setAutoCancel(true)
            .setTimeoutAfter(if (e.kind == Events.Kind.ADHAN) 60 * 60_000L else 6 * 3600_000L)
            .build()
        NotificationManagerCompat.from(ctx).notify(id, n)
    }

    fun test(ctx: Context) = show(ctx, Events.Event(System.currentTimeMillis(), Events.Kind.ADHAN, "dhuhr"), 0)

    private data class Quad(val a: String, val b: String, val c: String, val d: String)
}

object Format {
    fun digits(n: Int) = n.toString().map { if (it.isDigit()) '٠' + (it - '0') else it }.joinToString("")
    fun time(ms: Long, tz: String): String {
        val f = java.text.SimpleDateFormat("h:mm", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone(tz) }
        val ampm = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone(tz)).apply { timeInMillis = ms }.get(java.util.Calendar.AM_PM)
        return f.format(ms).map { if (it.isDigit()) '٠' + (it - '0') else it }.joinToString("") + if (ampm == 0) " ص" else " م"
    }
}
