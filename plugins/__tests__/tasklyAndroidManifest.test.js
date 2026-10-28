const fs = require('fs');
const path = require('path');
const { ICON_NAMES, adaptiveIconXml, aliasName, applyTasklyManifest, colorName } = require('../tasklyAndroidManifest');

function manifest() {
  return {
    manifest: {
      application: [
        {
          activity: [
            {
              $: { 'android:name': '.MainActivity', 'android:launchMode': 'singleTask' },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
                {
                  action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
                  data: [{ $: { 'android:scheme': 'taskly' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

const application = (m) => m.manifest.application[0];
const names = (list) => (list ?? []).map((item) => item.$['android:name']);

describe('applyTasklyManifest', () => {
  it('adds one launcher alias per icon; only the default one is enabled', () => {
    const result = applyTasklyManifest(manifest());

    const aliases = application(result)['activity-alias'];
    expect(aliases.map((alias) => alias.$['android:name'])).toEqual(ICON_NAMES.map(aliasName));
    expect(aliases.map((alias) => alias.$['android:enabled'])).toEqual(['true', 'false', 'false']);
    for (const alias of aliases) {
      expect(alias.$['android:targetActivity']).toBe('.MainActivity');
      expect(alias.$['android:exported']).toBe('true');
      expect(names(alias['intent-filter'][0].category)).toEqual(['android.intent.category.LAUNCHER']);
    }
    expect(aliases[0].$['android:icon']).toBe('@mipmap/ic_launcher');
    expect(aliases[1].$['android:icon']).toBe('@mipmap/ic_launcher_dark');
  });

  it('puts the app shortcuts on every launcher alias', () => {
    const aliases = application(applyTasklyManifest(manifest()))['activity-alias'];

    for (const alias of aliases) {
      expect(alias['meta-data'][0].$).toEqual({ 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/taskly_shortcuts' });
    }
  });

  it('takes the launcher category off the main activity so there is only one icon', () => {
    const main = application(applyTasklyManifest(manifest())).activity[0];

    const mainFilter = main['intent-filter'].find((filter) => names(filter.action).includes('android.intent.action.MAIN'));
    expect(mainFilter.category).toBeUndefined();
    const deepLink = main['intent-filter'].find((filter) => names(filter.action).includes('android.intent.action.VIEW'));
    expect(names(deepLink.category)).toEqual(['android.intent.category.DEFAULT']);
  });

  it('adds the share filter for plain text next to the existing filters', () => {
    const main = application(applyTasklyManifest(manifest())).activity[0];

    const share = main['intent-filter'].find((filter) => names(filter.action).includes('android.intent.action.SEND'));
    expect(share.data[0].$['android:mimeType']).toBe('text/plain');
    expect(names(share.category)).toEqual(['android.intent.category.DEFAULT']);
    expect(main['intent-filter']).toHaveLength(3);
  });

  it('running it twice changes nothing more', () => {
    const once = applyTasklyManifest(manifest());
    const snapshot = JSON.stringify(once);

    expect(JSON.stringify(applyTasklyManifest(once))).toBe(snapshot);
  });

  it('fails loudly without a main activity', () => {
    expect(() => applyTasklyManifest({ manifest: { application: [{ activity: [] }] } })).toThrow('.MainActivity');
  });
});

describe('icon resources', () => {
  it('draws the app foreground on the icon background colour', () => {
    const xml = adaptiveIconXml('dark');

    expect(xml).toContain('<adaptive-icon');
    expect(xml).toContain(`@color/${colorName('dark')}`);
    expect(xml).toContain('@mipmap/ic_launcher_foreground');
  });

  it('the plugin entry loads', () => {
    expect(typeof require('../withTasklyAndroid')).toBe('function');
  });
});

describe('native module resources', () => {
  const res = path.join(__dirname, '..', '..', 'modules', 'taskly-android', 'android', 'src', 'main', 'res');
  const read = (file) => fs.readFileSync(path.join(res, file), 'utf8');

  it('declares the four app shortcuts with their deep links', () => {
    const xml = read('xml/taskly_shortcuts.xml');

    for (const link of ['taskly://quick-add', 'taskly://today', 'taskly://upcoming', 'taskly://search']) {
      expect(xml).toContain(`android:data="${link}"`);
    }
    expect(xml.match(/<shortcut\b/g)).toHaveLength(4);
    expect(xml).toContain('android:targetClass="com.taskly.app.MainActivity"');
  });

  it('labels every shortcut and the tile in both languages', () => {
    const keys = ['tile_add_task', 'shortcut_add_task', 'shortcut_today', 'shortcut_upcoming', 'shortcut_search', 'alarm_channel_name', 'alarm_stop'];
    for (const file of ['values/strings.xml', 'values-vi/strings.xml']) {
      const xml = read(file);
      for (const key of keys) expect(xml).toMatch(new RegExp(`<string name="${key}">[^<]+</string>`));
    }
    expect(read('values-vi/strings.xml')).toContain('Thêm việc');
  });

  it('uses the same icon names as the JS side and the Kotlin module', () => {
    const kotlin = fs.readFileSync(
      path.join(res, '..', 'java', 'com', 'taskly', 'app', 'tasklyandroid', 'TasklyAndroidModule.kt'),
      'utf8',
    );

    expect(kotlin).toContain(`listOf(${ICON_NAMES.map((name) => `"${name}"`).join(', ')})`);
  });
});
