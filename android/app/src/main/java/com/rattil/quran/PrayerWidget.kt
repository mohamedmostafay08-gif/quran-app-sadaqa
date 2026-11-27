package com.rattil.quran

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews

/** ويدجت الشاشة الرئيسية: الصلاة القادمة ومواقيت اليوم */
class PrayerWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        for (id in ids) mgr.updateAppWidget(id, views(ctx))
    }

    companion object {
        private val ROWS = listOf(
            "fajr" to R.id.w_fajr, "sunrise" to R.id.w_sunrise, "dhuhr" to R.id.w_dhuhr,
            "asr" to R.id.w_asr, "maghrib" to R.id.w_maghrib, "isha" to R.id.w_isha,
        )

        fun updateAll(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PrayerWidget::class.java))
            if (ids.isNotEmpty()) for (id in ids) mgr.updateAppWidget(id, views(ctx))
        }

        fun views(ctx: Context, now: Long = System.currentTimeMillis()): RemoteViews {
            val v = RemoteViews(ctx.packageName, R.layout.widget_prayer)
            v.setOnClickPendingIntent(R.id.w_root, Notifier.openApp(ctx, "#/prayer", 100))
            val s = Scheduler.load(ctx)
            val today = s?.let { Events.today(it, now) }
            val next = s?.let { Events.nextPrayer(it, now) }
            if (s == null || today == null || next == null) {
                v.setTextViewText(R.id.w_city, "رتّل")
                v.setTextViewText(R.id.w_next, "افتح التطبيق وحدّد موقعك")
                v.setTextViewText(R.id.w_next_time, "")
                for ((_, id) in ROWS) v.setTextViewText(id, "")
                return v
            }
            v.setTextViewText(R.id.w_city, s.city.ifEmpty { "مواقيت الصلاة" })
            v.setTextViewText(R.id.w_next, "${Events.NAMES[next.first]} — القادمة")
            v.setTextViewText(R.id.w_next_time, Format.time(next.second, s.tz))
            for ((key, id) in ROWS) {
                val t = today[Schedule.KEYS.indexOf(key)]
                v.setTextViewText(id, "${Events.NAMES[key]}  ${Format.time(t, s.tz)}")
            }
            return v
        }
    }
}
