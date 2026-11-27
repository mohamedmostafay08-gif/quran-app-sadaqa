package com.rattil.quran

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

/** يحفظ الجدول ويضبط منبّهًا واحدًا للموعد القادم؛ كل منبّه عند وصوله يضبط الذي يليه */
object Scheduler {
    private const val PREFS = "rattil"
    private const val KEY = "schedule"
    const val EXTRA_AT = "at"
    const val ACTION_FIRE = "com.rattil.quran.FIRE"
    const val ACTION_WIDGET = "com.rattil.quran.WIDGET"

    fun save(ctx: Context, json: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply()
        reschedule(ctx)
    }

    fun load(ctx: Context): Schedule? =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)?.let(Schedule::parse)

    fun canExact(ctx: Context): Boolean {
        val am = ctx.getSystemService(AlarmManager::class.java)
        return Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()
    }

    private fun pending(ctx: Context, action: String, at: Long, code: Int): PendingIntent =
        PendingIntent.getBroadcast(
            ctx, code,
            Intent(ctx, AlarmReceiver::class.java).setAction(action).putExtra(EXTRA_AT, at),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    fun reschedule(ctx: Context, now: Long = System.currentTimeMillis()) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val s = load(ctx)
        val e = s?.let { Events.next(it, now) }
        if (e == null) {
            am.cancel(pending(ctx, ACTION_FIRE, 0, 1))
        } else {
            val pi = pending(ctx, ACTION_FIRE, e.at, 1)
            // بلا إذن المنبّهات الدقيقة (أندرويد ١٢+) نستخدم نافذة قصيرة بدل الدقة التامة
            if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, e.at, pi)
            else am.setWindow(AlarmManager.RTC_WAKEUP, e.at, 60_000, pi)
        }
        // تحديث الويدجت عند دخول كل صلاة (غير دقيق، لا يحتاج إذنًا)
        val np = s?.let { Events.nextPrayer(it, now) }
        if (np != null) am.set(AlarmManager.RTC, np.second + 1_000, pending(ctx, ACTION_WIDGET, np.second, 2))
        PrayerWidget.updateAll(ctx)
    }
}
