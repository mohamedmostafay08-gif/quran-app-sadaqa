package com.rattil.quran

import org.json.JSONObject

/**
 * ما يرسله تطبيق الويب عبر الجسر: مواقيت ٦٠ يومًا محسوبة بنفس مكتبة الشاشة (بالمللي ثانية)،
 * والصلوات المفعّل أذانها، ودقائق التنبيه قبل الأذان، وموعد الورد اليومي HH:MM.
 */
data class Schedule(
    val city: String,
    val tz: String,
    /** كل يوم: [fajr, sunrise, dhuhr, asr, maghrib, isha] */
    val days: List<LongArray>,
    val prayers: List<String>,
    val preAdhan: Int,
    val wirdTime: String?,
) {
    companion object {
        val KEYS = listOf("fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha")

        fun parse(json: String): Schedule? = try {
            val o = JSONObject(json)
            val days = o.optJSONArray("days")
            Schedule(
                city = o.optString("city"),
                tz = o.optString("tz").ifEmpty { java.util.TimeZone.getDefault().id },
                days = (0 until (days?.length() ?: 0)).map { i ->
                    val d = days!!.getJSONObject(i)
                    LongArray(KEYS.size) { k -> d.optLong(KEYS[k]) }
                },
                prayers = o.optJSONArray("prayers")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList(),
                preAdhan = o.optInt("preAdhan"),
                wirdTime = o.optString("wirdTime").takeIf { it.matches(Regex("\\d{2}:\\d{2}")) },
            )
        } catch (e: Exception) { null }
    }
}
