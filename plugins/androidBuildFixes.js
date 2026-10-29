// Pure text edits applied to the generated android/ project by withAndroidBuildFixes.
// Both fixes come from the first Windows build of the development build:
// - ninja 1.10 (CMake 3.22 in the Android SDK) cannot open object paths over 260 chars while Windows long paths are
//   off; CMAKE_OBJECT_PATH_MAX makes CMake hash long object directories instead.
// - the Gradle wrapper only waits 10 s for the distribution download, which times out on slow networks.

const CMAKE_OBJECT_PATH_MAX_ARG = '-DCMAKE_OBJECT_PATH_MAX=240';
const GRADLE_NETWORK_TIMEOUT_MS = 300000;

/** Adds an externalNativeBuild.cmake argument to android.defaultConfig in app/build.gradle (idempotent). */
function addCmakeObjectPathMax(buildGradle) {
  if (buildGradle.includes(CMAKE_OBJECT_PATH_MAX_ARG)) return buildGradle;
  const anchor = /defaultConfig\s*\{\n/;
  if (!anchor.test(buildGradle)) {
    throw new Error('withAndroidBuildFixes: defaultConfig block not found in app/build.gradle');
  }
  const block = [
    '        externalNativeBuild {',
    '            cmake {',
    `                arguments "${CMAKE_OBJECT_PATH_MAX_ARG}"`,
    '            }',
    '        }',
    '',
  ].join('\n');
  return buildGradle.replace(anchor, (match) => match + block);
}

/** Sets networkTimeout in gradle-wrapper.properties, adding the key when missing (idempotent). */
function setGradleNetworkTimeout(properties) {
  const line = `networkTimeout=${GRADLE_NETWORK_TIMEOUT_MS}`;
  if (/^networkTimeout=.*$/m.test(properties)) {
    return properties.replace(/^networkTimeout=.*$/m, line);
  }
  const base = properties.endsWith('\n') ? properties : `${properties}\n`;
  return `${base}${line}\n`;
}

// R8 strips androidx.work.impl.WorkDatabase_Impl (only reached by reflection) and the release build crashes on launch
// with "Failed to create an instance of class androidx.work.impl.WorkDatabase".
const PROGUARD_MARKER = '# Taskly: WorkManager (Room) keep rules';
const WORKMANAGER_PROGUARD_RULES = [
  '-keep class * extends androidx.room.RoomDatabase',
  '-keep class androidx.work.impl.WorkDatabase_Impl { *; }',
  '-keep class androidx.work.impl.** { *; }',
];

/** Appends the WorkManager keep rules to proguard-rules.pro (idempotent). */
function addWorkManagerProguardRules(proguard) {
  if (proguard.includes(PROGUARD_MARKER)) return proguard;
  const base = proguard.length === 0 || proguard.endsWith('\n') ? proguard : `${proguard}\n`;
  return `${base}\n${PROGUARD_MARKER}\n${WORKMANAGER_PROGUARD_RULES.join('\n')}\n`;
}

// Release builds block plain HTTP (only src/debug/AndroidManifest.xml allows it), so an APK that talks to
// http://localhost:8080 through `adb reverse` shows an empty app. Opt in at prebuild time; a real release build
// (https API URL, no flag) is left untouched.
function shouldAllowCleartext(env) {
  return env.TASKLY_ALLOW_CLEARTEXT === '1' || /^http:\/\//i.test(env.EXPO_PUBLIC_API_URL || '');
}

/** Sets android:usesCleartextTraffic on <application> of the xml2js manifest when enabled. */
function setCleartextTraffic(manifest, enabled) {
  if (!enabled) return manifest;
  const app = manifest.manifest.application && manifest.manifest.application[0];
  if (app) app.$['android:usesCleartextTraffic'] = 'true';
  return manifest;
}

module.exports = {
  shouldAllowCleartext,
  setCleartextTraffic,
  WORKMANAGER_PROGUARD_RULES,
  addWorkManagerProguardRules,
  CMAKE_OBJECT_PATH_MAX_ARG,
  GRADLE_NETWORK_TIMEOUT_MS,
  addCmakeObjectPathMax,
  setGradleNetworkTimeout,
};
