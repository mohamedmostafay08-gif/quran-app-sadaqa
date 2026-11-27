package com.rattil.quran

import java.util.Calendar
import java.util.TimeZone

/** حساب المواعيد القادمة من الجدول (منطق خالص بلا أندرويد، لتسهيل اختباره) */
object Events {
    val NAMES = mapOf("fajr" to "الفجر", "sunrise" to "الشروق", "dhuhr" to "الظهر", "asr" to "العصر", "maghrib" to "المغرب", "isha" to "العشاء")
    val PRAYERS = listOf("fajr", "dhuhr", "asr", "maghrib", "isha")

    enum class Kind { ADHAN, PRE, WIRD, STALE }

    data class Event(val at: Long, val kind: Kind, val prayer: String? = null)

    /** تذكير بفتح التطبيق قبل نفاد المواقيت المرسلة بيومين */
    private const val STALE_MARGIN = 2 * 86_400_000L

    fun upcoming(s: Schedule, now: Long, tz: TimeZone = TimeZone.getDefault()): List<Event> {
        val out = mutableListOf<Event>()
        for (day in s.days) for (p in s.prayers) {
            val i = Schedule.KEYS.indexOf(p)
            if (i < 0 || p == "sunrise") continue
            val t = day[i]
            if (t > now) out += Event(t, Kind.ADHAN, p)
            if (s.preAdhan > 0) { val pt = t - s.preAdhan * 60_000L; if (pt > now) out += Event(pt, Kind.PRE, p) }
        }
        s.wirdTime?.let { hm ->
            val (h, m) = hm.split(":").map { it.toInt() }
            for (d in 0..1) {
                val c = Calendar.getInstance(tz).apply {
                    timeInMillis = now; add(Calendar.DAY_OF_YEAR, d)
                    set(Calendar.HOUR_OF_DAY, h); set(Calendar.MINUTE, m); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                }
                if (c.timeInMillis > now) out += Event(c.timeInMillis, Kind.WIRD)
            }
        }
        val lastFajr = s.days.lastOrNull()?.get(0)
        if (lastFajr != null && s.prayers.isNotEmpty()) {
            val staleAt = lastFajr - STALE_MARGIN
            if (staleAt > now) out += Event(staleAt, Kind.STALE)
        }
        return out.sortedBy { it.at }
    }

    fun next(s: Schedule, now: Long, tz: TimeZone = TimeZone.getDefault()) = upcoming(s, now, tz).firstOrNull()

    /** كل المواعيد في نفس اللحظة (مثلًا الورد مع الأذان في الدقيقة نفسها) */
    fun dueAt(s: Schedule, at: Long, tz: TimeZone = TimeZone.getDefault()) = upcoming(s, at - 1, tz).filter { it.at == at }

    /** الصلاة القادمة من الخمس (للويدجت) */
    fun nextPrayer(s: Schedule, now: Long): Pair<String, Long>? {
        for (day in s.days) for (p in PRAYERS) {
            val t = day[Schedule.KEYS.indexOf(p)]
            if (t > now) return p to t
        }
        return null
    }

    /** مواقيت اليوم الحالي (أول يوم لم ينته عشاؤه) */
    fun today(s: Schedule, now: Long): LongArray? = s.days.firstOrNull { it[5] > now } ?: s.days.lastOrNull()
}
