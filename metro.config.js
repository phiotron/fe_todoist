// Metro config. Identical to Expo's default unless EXPO_GO_SHIMS=1 (test-only: running the app inside Expo Go, which
// is a prebuilt app and lacks two native modules this app imports at startup). The real builds (development build,
// release) never set the flag, so nothing is replaced there.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_GO_SHIMS === '1') {
  const shims = path.join(__dirname, 'scripts', 'expo-go-shims');
  const googleStub = path.join(shims, 'google-signin.js');
  const topicStub = path.join(shims, 'push-topic-module.js');
  const notificationsBuild = path.join('expo-notifications', 'build');

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    // @react-native-google-signin throws on import (TurboModuleRegistry.getEnforcing) when the native module is missing.
    if (moduleName === '@react-native-google-signin/google-signin') {
      return { type: 'sourceFile', filePath: googleStub };
    }
    // expo-notifications on Android requires ExpoTopicSubscriptionModule, which Expo Go does not ship; the iOS / web
    // variant of that file is a no-op object, so the stub mirrors it.
    if (
      platform === 'android' &&
      moduleName === './TopicSubscriptionModule' &&
      context.originModulePath.includes(notificationsBuild)
    ) {
      return { type: 'sourceFile', filePath: topicStub };
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
