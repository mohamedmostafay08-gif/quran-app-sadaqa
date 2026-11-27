package com.rattil.quran

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.TimeZone

class EventsTest {
    private val tz = TimeZone.getTimeZone("Africa/Cairo")
    private val H = 3_600_000L
    private val M = 60_000L
    // يوم ٢٠٢٧-٠١-٠١ بتوقيت القاهرة (UTC+2): منتصف الليل = ٢٠٢٦-١٢-٣١ ٢٢:٠٠ UTC
    private val day0 = 1798754400000L

    private fun day(base: Long) = longArrayOf(base + 5 * H, base + 6 * H + 30 * M, base + 12 * H, base + 15 * H, base + 17 * H, base + 18 * H + 30 * M)
    private fun sched(prayers: List<String> = Events.PRAYERS, pre: Int = 0, wird: String? = null, days: Int = 3) =
        Schedule("القاهرة", "Africa/Cairo", (0 until days).map { day(day0 + it * 24 * H) }, prayers, pre, wird)

    @Test fun nextAdhanIsTheFirstFuturePrayer() {
        val e = Events.next(sched(), day0 + 11 * H, tz)!!
        assertEquals(Events.Kind.ADHAN, e.kind); assertEquals("dhuhr", e.prayer); assertEquals(day0 + 12 * H, e.at)
    }

    @Test fun disabledPrayersAndSunriseAreSkipped() {
        val e = Events.next(sched(prayers = listOf("sunrise", "maghrib")), day0 + 11 * H, tz)!!
        assertEquals("maghrib", e.prayer)
    }

    @Test fun preAdhanComesBeforeAdhan() {
        val list = Events.upcoming(sched(listOf("dhuhr"), pre = 15), day0 + 11 * H, tz)
        assertEquals(Events.Kind.PRE, list[0].kind); assertEquals(day0 + 12 * H - 15 * M, list[0].at)
        assertEquals(Events.Kind.ADHAN, list[1].kind)
    }

    @Test fun wirdIsDailyInLocalTime() {
        val list = Events.upcoming(sched(emptyList(), wird = "21:00"), day0 + 22 * H, tz)
        val wird = list.filter { it.kind == Events.Kind.WIRD }
        assertEquals(1, wird.size) // اليوم فات، فالقادم غدًا فقط ضمن اليومين
        assertEquals(day0 + 24 * H + 21 * H, wird[0].at)
    }

    @Test fun simultaneousEventsAreAllDue() {
        val s = sched(listOf("isha"), wird = "18:30")
        val due = Events.dueAt(s, day0 + 18 * H + 30 * M, tz)
        assertEquals(setOf(Events.Kind.ADHAN, Events.Kind.WIRD), due.map { it.kind }.toSet())
    }

    @Test fun staleReminderBeforeTimesRunOut() {
        val s = sched(days = 5)
        val stale = Events.upcoming(s, day0, tz).single { it.kind == Events.Kind.STALE }
        assertEquals(s.days.last()[0] - 2 * 24 * H, stale.at)
    }

    @Test fun nothingAfterScheduleEnds() {
        assertNull(Events.next(sched(), day0 + 10 * 24 * H, tz))
        assertNull(Events.nextPrayer(sched(), day0 + 10 * 24 * H))
    }

    @Test fun widgetTodayAndNextPrayer() {
        val s = sched()
        assertEquals(day0 + 5 * H, Events.today(s, day0 + H)!![0])
        assertEquals(day0 + 24 * H + 5 * H, Events.today(s, day0 + 20 * H)!![0]) // بعد العشاء: مواقيت الغد
        assertEquals("fajr" to day0 + 29 * H, Events.nextPrayer(s, day0 + 20 * H))
    }

    @Test fun arabicTimeFormat() {
        val t = Format.time(day0 + 17 * H + 5 * M, "Africa/Cairo")
        assertTrue(t, t == "٥:٠٥ م")
    }
}
