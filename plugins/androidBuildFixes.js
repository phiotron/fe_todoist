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

module.exports = {
  CMAKE_OBJECT_PATH_MAX_ARG,
  GRADLE_NETWORK_TIMEOUT_MS,
  addCmakeObjectPathMax,
  setGradleNetworkTimeout,
};
