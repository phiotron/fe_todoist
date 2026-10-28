package com.taskly.app.tasklyandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** System alarms are lost on reboot: put every urgent alarm that is still in the future back. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val store = UrgentAlarmStore(context)
    val now = System.currentTimeMillis()
    for (alarm in store.all()) {
      if (alarm.fireAtMs > now) UrgentAlarmScheduler.schedule(context, alarm) else store.remove(alarm.id)
    }
  }
}
