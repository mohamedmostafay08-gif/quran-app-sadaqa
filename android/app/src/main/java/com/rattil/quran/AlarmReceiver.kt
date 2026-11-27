package com.rattil.quran

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** منبّه الموعد: يعرض الإشعار (أو الإشعارات المتزامنة) ثم يضبط الموعد التالي */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val now = System.currentTimeMillis()
        if (intent.action == Scheduler.ACTION_FIRE) {
            val s = Scheduler.load(ctx)
            val at = intent.getLongExtra(Scheduler.EXTRA_AT, 0)
            // لا نعرض إشعارًا متأخرًا جدًا (الجهاز كان مغلقًا مثلًا)
            if (s != null && at > 0 && now - at < 15 * 60_000L) {
                for (e in Events.dueAt(s, at)) Notifier.show(ctx, e, s.preAdhan)
            }
        }
        Scheduler.reschedule(ctx, maxOf(now, intent.getLongExtra(Scheduler.EXTRA_AT, 0)))
    }
}

/** بعد إعادة التشغيل أو تغيير الوقت أو تحديث التطبيق: المنبّهات تُمسح، فنعيد ضبطها */
class BootReceiver : BroadcastReceiver() {
    private val actions = setOf(
        Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED,
        "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
    )
    override fun onReceive(ctx: Context, intent: Intent) { if (intent.action in actions) Scheduler.reschedule(ctx) }
}
