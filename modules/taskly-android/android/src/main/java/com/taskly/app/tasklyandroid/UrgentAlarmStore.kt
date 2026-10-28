package com.taskly.app.tasklyandroid

import android.content.Context
import org.json.JSONObject

/** One scheduled urgent alarm. `signature` is the JS side's fingerprint (changes when the reminder changes). */
data class UrgentAlarm(
  val id: String,
  val taskId: String,
  val fireAtMs: Long,
  val title: String,
  val body: String,
  val signature: String,
) {
  fun toJson(): String = JSONObject()
    .put("id", id).put("taskId", taskId).put("fireAtMs", fireAtMs)
    .put("title", title).put("body", body).put("signature", signature)
    .toString()

  companion object {
    fun fromJson(text: String): UrgentAlarm? = try {
      val json = JSONObject(text)
      UrgentAlarm(
        json.getString("id"), json.getString("taskId"), json.getLong("fireAtMs"),
        json.getString("title"), json.getString("body"), json.getString("signature"),
      )
    } catch (_: Exception) {
      null
    }
  }
}

/**
 * Alarms waiting to ring, kept in SharedPreferences so they can be listed to JS (the sync diff) and put back after a
 * reboot (BootReceiver). An entry is removed when the alarm rings or is cancelled.
 */
class UrgentAlarmStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun put(alarm: UrgentAlarm) {
    prefs.edit().putString(alarm.id, alarm.toJson()).apply()
  }

  fun remove(id: String) {
    prefs.edit().remove(id).apply()
  }

  fun get(id: String): UrgentAlarm? = prefs.getString(id, null)?.let(UrgentAlarm::fromJson)

  fun all(): List<UrgentAlarm> = prefs.all.values.mapNotNull { (it as? String)?.let(UrgentAlarm::fromJson) }

  companion object {
    private const val NAME = "taskly_urgent_alarms"
  }
}
