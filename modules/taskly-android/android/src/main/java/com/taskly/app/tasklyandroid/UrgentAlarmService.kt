package com.taskly.app.tasklyandroid

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat

/**
 * Rings an urgent reminder: a looping alarm sound (USAGE_ALARM, so it passes Do Not Disturb) with vibration, and a
 * full-screen notification that opens taskly://alarm/<taskId> over the lock screen. Runs until Stop (the notification
 * button, the alarm screen or JS stopUrgentAlarm) or five minutes, whichever comes first.
 */
class UrgentAlarmService : Service() {
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())
  private var currentTaskId: String? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopRinging()
      return START_NOT_STICKY
    }
    val taskId = intent?.getStringExtra(EXTRA_TASK_ID) ?: return START_NOT_STICKY
    val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
    val body = intent.getStringExtra(EXTRA_BODY).orEmpty()
    currentTaskId = taskId
    startForegroundCompat(buildNotification(taskId, title, body))
    startSoundAndVibration()
    handler.postDelayed({ stopRinging() }, MAX_RING_MS)
    return START_NOT_STICKY
  }

  private fun buildNotification(taskId: String, title: String, body: String): Notification {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, getString(R.string.alarm_channel_name), NotificationManager.IMPORTANCE_HIGH)
      channel.setSound(null, null) // the sound is played by this service
      channel.setBypassDnd(true)
      channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      manager.createNotificationChannel(channel)
    }
    val open = UrgentAlarmScheduler.openAlarmScreen(this, taskId)
    val stop = PendingIntent.getService(
      this, 1, Intent(this, UrgentAlarmService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .addAction(0, getString(R.string.alarm_stop), stop)
      .build()
  }

  private fun startForegroundCompat(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  private fun startSoundAndVibration() {
    val uri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    player?.release()
    player = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      setDataSource(this@UrgentAlarmService, uri)
      isLooping = true
      prepare()
      start()
    }
    @Suppress("DEPRECATION")
    vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    val pattern = longArrayOf(0, 600, 400)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
    } else {
      @Suppress("DEPRECATION")
      vibrator?.vibrate(pattern, 0)
    }
  }

  private fun stopRinging() {
    handler.removeCallbacksAndMessages(null)
    player?.run { runCatching { stop() }; release() }
    player = null
    vibrator?.cancel()
    currentTaskId = null
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    player?.release()
    vibrator?.cancel()
    super.onDestroy()
  }

  companion object {
    private const val CHANNEL_ID = "taskly_urgent_alarm"
    private const val NOTIFICATION_ID = 7101
    private const val MAX_RING_MS = 5 * 60 * 1000L
    private const val ACTION_STOP = "com.taskly.app.URGENT_ALARM_STOP"
    private const val EXTRA_TASK_ID = "taskId"
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"

    fun startIntent(context: Context, alarm: UrgentAlarm): Intent =
      Intent(context, UrgentAlarmService::class.java)
        .putExtra(EXTRA_TASK_ID, alarm.taskId)
        .putExtra(EXTRA_TITLE, alarm.title)
        .putExtra(EXTRA_BODY, alarm.body)

    fun stopIntent(context: Context): Intent =
      Intent(context, UrgentAlarmService::class.java).setAction(ACTION_STOP)
  }
}
