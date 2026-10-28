package com.taskly.app.tasklyandroid

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat

/** The alarm time came: start the ringing service (full-screen notification + alarm sound) for that reminder. */
class UrgentAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra(UrgentAlarmScheduler.EXTRA_ID) ?: return
    val store = UrgentAlarmStore(context)
    val alarm = store.get(id) ?: return // cancelled after the system alarm was set
    store.remove(id)
    ContextCompat.startForegroundService(context, UrgentAlarmService.startIntent(context, alarm))
  }
}
