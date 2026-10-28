package com.taskly.app.tasklyandroid

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Sets / cancels the system alarm of an urgent reminder. setAlarmClock is used on purpose: it fires on time even in
 * Doze, needs no SCHEDULE_EXACT_ALARM grant and may start the ringing foreground service from the background.
 */
object UrgentAlarmScheduler {
  const val EXTRA_ID = "id"
  const val EXTRA_TASK_ID = "taskId"

  private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun firePending(context: Context, alarm: UrgentAlarm, create: Boolean): PendingIntent? {
    val intent = Intent(context, UrgentAlarmReceiver::class.java).apply {
      action = "com.taskly.app.URGENT_ALARM"
      data = Uri.parse("taskly-alarm://${alarm.id}") // makes the PendingIntent unique per reminder
      putExtra(EXTRA_ID, alarm.id)
      putExtra(EXTRA_TASK_ID, alarm.taskId)
    }
    val flags = PendingIntent.FLAG_IMMUTABLE or (if (create) PendingIntent.FLAG_UPDATE_CURRENT else PendingIntent.FLAG_NO_CREATE)
    return PendingIntent.getBroadcast(context, 0, intent, flags)
  }

  /** The screen the alarm clock icon opens: the alarm screen of the task. */
  fun openAlarmScreen(context: Context, taskId: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("taskly://alarm/$taskId"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    return PendingIntent.getActivity(context, taskId.hashCode(), intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  fun schedule(context: Context, alarm: UrgentAlarm) {
    val info = AlarmManager.AlarmClockInfo(alarm.fireAtMs, openAlarmScreen(context, alarm.taskId))
    alarmManager(context).setAlarmClock(info, firePending(context, alarm, create = true)!!)
  }

  fun cancel(context: Context, alarm: UrgentAlarm) {
    firePending(context, alarm, create = false)?.let {
      alarmManager(context).cancel(it)
      it.cancel()
    }
  }
}
