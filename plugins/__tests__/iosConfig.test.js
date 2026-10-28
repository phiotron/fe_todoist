const fs = require('fs');
const path = require('path');
const { PLUGIN, withOptionalGoogleSignIn } = require('../optionalGoogleSignIn');

const root = path.join(__dirname, '..', '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const createConfig = require('../../app.config.js');

const SCHEME = 'com.googleusercontent.apps.1234567890-abcdef';

describe('iOS config in app.json (X5)', () => {
  it('has the bundle id, Apple sign-in and the location / background strings', () => {
    expect(appJson.ios.bundleIdentifier).toBe('com.taskly.app');
    expect(appJson.ios.usesAppleSignIn).toBe(true);
    expect(appJson.ios.supportsTablet).toBe(true);
    const plist = appJson.ios.infoPlist;
    expect(plist.NSLocationWhenInUseUsageDescription).toMatch(/location/);
    expect(plist.NSLocationAlwaysAndWhenInUseUsageDescription).toMatch(/location/);
    expect(plist.UIBackgroundModes).toEqual(expect.arrayContaining(['location', 'remote-notification']));
    expect(plist.ITSAppUsesNonExemptEncryption).toBe(false);
  });

  it('does not add associated domains (no domain yet)', () => {
    expect(appJson.ios.associatedDomains).toBeUndefined();
  });

  it('keeps the Android config as it was', () => {
    expect(appJson.android.package).toBe('com.taskly.app');
    expect(appJson.android.permissions).toEqual([
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.SCHEDULE_EXACT_ALARM',
    ]);
    expect(appJson.scheme).toBe('taskly');
    const location = appJson.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-location')[1];
    expect(location.isAndroidBackgroundLocationEnabled).toBe(true);
    expect(location.isIosBackgroundLocationEnabled).toBe(true);
    expect(appJson.plugins).toEqual(expect.arrayContaining(['./plugins/withTasklyAndroid', './plugins/withAndroidBuildFixes']));
  });

  it('has no secret-looking values (only the public bundle id)', () => {
    expect(JSON.stringify(appJson)).not.toMatch(/GOCSPX|apps\.googleusercontent\.com|AIza|-----BEGIN/);
  });
});

describe('app.config.js / optional Google Sign-In plugin', () => {
  it('leaves the config untouched when no iOS URL scheme is set', () => {
    expect(withOptionalGoogleSignIn(appJson, {})).toBe(appJson);
    expect(withOptionalGoogleSignIn(appJson, { GOOGLE_IOS_URL_SCHEME: '   ' })).toBe(appJson);
  });

  it('adds the plugin with the scheme from GOOGLE_IOS_URL_SCHEME or EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME', () => {
    for (const name of ['GOOGLE_IOS_URL_SCHEME', 'EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME']) {
      const result = withOptionalGoogleSignIn(appJson, { [name]: SCHEME });
      expect(result.plugins).toHaveLength(appJson.plugins.length + 1);
      expect(result.plugins[result.plugins.length - 1]).toEqual([PLUGIN, { iosUrlScheme: SCHEME }]);
      expect({ ...result, plugins: undefined }).toEqual({ ...appJson, plugins: undefined });
    }
  });

  it('skips (and warns about) a scheme the plugin would reject, so the build still runs', () => {
    const warn = jest.fn();
    expect(withOptionalGoogleSignIn(appJson, { GOOGLE_IOS_URL_SCHEME: 'not-a-scheme' }, warn)).toBe(appJson);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not add the plugin twice', () => {
    const once = withOptionalGoogleSignIn(appJson, { GOOGLE_IOS_URL_SCHEME: SCHEME });
    expect(withOptionalGoogleSignIn(once, { GOOGLE_IOS_URL_SCHEME: SCHEME })).toBe(once);
  });

  it('app.config.js returns app.json unchanged (plus the plugin only when the environment asks)', () => {
    const saved = { a: process.env.GOOGLE_IOS_URL_SCHEME, b: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME };
    delete process.env.GOOGLE_IOS_URL_SCHEME;
    delete process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
    try {
      expect(createConfig({ config: appJson })).toEqual(appJson);
      process.env.GOOGLE_IOS_URL_SCHEME = SCHEME;
      expect(createConfig({ config: appJson }).plugins).toContainEqual([PLUGIN, { iosUrlScheme: SCHEME }]);
    } finally {
      if (saved.a === undefined) delete process.env.GOOGLE_IOS_URL_SCHEME;
      else process.env.GOOGLE_IOS_URL_SCHEME = saved.a;
      if (saved.b !== undefined) process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME = saved.b;
    }
  });
});

describe('eas.json (X5)', () => {
  it('has development / preview / production with a dev client and real-device iOS builds', () => {
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(['development', 'preview', 'production']));
    expect(eas.build.development.developmentClient).toBe(true);
    for (const profile of ['development', 'preview', 'production']) {
      expect(eas.build[profile].ios.simulator).toBe(false);
    }
  });

  it('holds no keys or ids', () => {
    expect(JSON.stringify(eas)).not.toMatch(/ascAppId|appleId|appleTeamId|serviceAccountKeyPath|projectId/);
  });
});
