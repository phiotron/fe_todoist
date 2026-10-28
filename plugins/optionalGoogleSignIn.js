// X5: Google Sign-In on iOS needs the URL scheme (REVERSED_CLIENT_ID of the iOS OAuth client) in Info.plist; the plugin
// @react-native-google-signin/google-signin throws without it. The scheme comes from the environment, so a build made
// without it still works: the plugin is simply not added and Google sign-in is "not configured" on iOS.
const PLUGIN = '@react-native-google-signin/google-signin';
const SCHEME_PREFIX = 'com.googleusercontent.apps.';

function readIosUrlScheme(env) {
  const value = (env.GOOGLE_IOS_URL_SCHEME || env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME || '').trim();
  return value === '' ? null : value;
}

/** Returns a copy of the Expo config with the Google plugin added when the environment has a valid iOS URL scheme. */
function withOptionalGoogleSignIn(config, env = process.env, warn = console.warn) {
  const scheme = readIosUrlScheme(env);
  if (scheme === null) return config;
  if (!scheme.startsWith(SCHEME_PREFIX)) {
    warn(`GOOGLE_IOS_URL_SCHEME must start with "${SCHEME_PREFIX}"; Google sign-in is left out of the iOS build.`);
    return config;
  }
  const plugins = config.plugins ?? [];
  const already = plugins.some((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === PLUGIN);
  if (already) return config;
  return { ...config, plugins: [...plugins, [PLUGIN, { iosUrlScheme: scheme }]] };
}

module.exports = { PLUGIN, SCHEME_PREFIX, readIosUrlScheme, withOptionalGoogleSignIn };
