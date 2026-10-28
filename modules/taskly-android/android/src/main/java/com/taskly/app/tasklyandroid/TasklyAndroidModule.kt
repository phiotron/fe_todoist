package com.taskly.app.tasklyandroid

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS API of the local Expo module "TasklyAndroid" (src/lib/native/tasklyAndroid.ts is the typed mirror). Everything here
 * is Android-only M12 plumbing: Dynamic Color, full-screen permission, launcher icon aliases, completion tone,
 * urgent alarms and the text shared into the app.
 */
class TasklyAndroidModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TasklyAndroid")

    Events("onSharedText")

    // ---- Dynamic Color (Android 12+): the system accent palette as #RRGGBB, null below API 31.
    Function("getDynamicColors") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function null
      fun hex(id: Int) = String.format("#%06X", 0xFFFFFF and context.getColor(id))
      mapOf(
        "accentLight" to hex(android.R.color.system_accent1_600),
        "accentLightStrong" to hex(android.R.color.system_accent1_700),
        "accentLightSoft" to hex(android.R.color.system_accent1_100),
        "accentDark" to hex(android.R.color.system_accent1_200),
        "accentDarkStrong" to hex(android.R.color.system_accent1_100),
        "accentDarkSoft" to hex(android.R.color.system_accent1_800),
      )
    }

    // ---- Full-screen notifications (Android 14+ lets the user switch them off).
    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT < 34) return@Function true
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent()
    }

    AsyncFunction("openFullScreenIntentSettings") {
      val intent = if (Build.VERSION.SDK_INT >= 34) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    // ---- Launcher icon: one activity-alias per icon (added by plugins/withTasklyAndroid.js), only one enabled.
    Function("getAppIcon") {
      ICONS.firstOrNull { name -> aliasState(name) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED }
        ?: ICONS.firstOrNull { name -> aliasState(name) == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT && name == "default" }
        ?: "default"
    }

    AsyncFunction("setAppIcon") { name: String, promise: Promise ->
      if (name !in ICONS) {
        promise.reject("ERR_UNKNOWN_ICON", "Unknown icon $name", null)
        return@AsyncFunction
      }
      // Enable the chosen alias first so the app never has no launcher entry.
      val pm = context.packageManager
      pm.setComponentEnabledSetting(alias(name), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      for (other in ICONS.filter { it != name }) {
        pm.setComponentEnabledSetting(alias(other), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      }
      promise.resolve(null)
    }

    // ---- Task complete tone.
    Function("playCompletionTone") {
      val generator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 60)
      generator.startTone(ToneGenerator.TONE_PROP_ACK, 160)
      Handler(Looper.getMainLooper()).postDelayed({ generator.release() }, 400)
    }

    // ---- Urgent reminders.
    AsyncFunction("scheduleUrgentAlarm") { request: Map<String, Any?> ->
      val alarm = UrgentAlarm(
        id = request["id"] as String,
        taskId = request["taskId"] as String,
        fireAtMs = (request["fireAtMs"] as Number).toLong(),
        title = request["title"] as String,
        body = request["body"] as String,
        signature = request["signature"] as String,
      )
      UrgentAlarmStore(context).put(alarm)
      UrgentAlarmScheduler.schedule(context, alarm)
    }

    AsyncFunction("cancelUrgentAlarm") { id: String ->
      val store = UrgentAlarmStore(context)
      store.get(id)?.let { UrgentAlarmScheduler.cancel(context, it) }
      store.remove(id)
    }

    AsyncFunction("listUrgentAlarms") {
      UrgentAlarmStore(context).all().map { mapOf("id" to it.id, "taskId" to it.taskId, "signature" to it.signature) }
    }

    Function("stopUrgentAlarm") { _: String ->
      context.startService(UrgentAlarmService.stopIntent(context))
    }

    // ---- Text shared into the app (intent filter SEND text/plain added by the config plugin).
    Function("takeSharedText") {
      val activity = appContext.currentActivity ?: return@Function null
      SharedText.take(activity.intent)
    }

    OnNewIntent { intent ->
      SharedText.take(intent)?.let { sendEvent("onSharedText", mapOf("text" to it)) }
    }
  }

  private fun alias(name: String) = ComponentName(context.packageName, "${context.packageName}.Icon${name.replaceFirstChar { it.uppercase() }}")

  private fun aliasState(name: String) = context.packageManager.getComponentEnabledSetting(alias(name))

  companion object {
    /** Same names as src/lib/native/appIcons.ts and the aliases of the config plugin. */
    private val ICONS = listOf("default", "dark", "light")
  }
}

/** Reads (and consumes, so it is used once) the text of an ACTION_SEND text/plain intent. */
object SharedText {
  fun take(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND || intent.type?.startsWith("text/") != true) return null
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT)
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    intent.action = null
    intent.removeExtra(Intent.EXTRA_TEXT)
    intent.removeExtra(Intent.EXTRA_SUBJECT)
    // A page title + link share (browsers) → "title\nlink": the title becomes the task name.
    return listOfNotNull(subject?.takeIf { it.isNotBlank() && text?.contains(it) != true }, text)
      .joinToString("\n")
      .takeIf { it.isNotBlank() }
  }
}
