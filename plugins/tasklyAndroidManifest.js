// Pure edits of the Android manifest and resources that M12 needs. Kept apart from withTasklyAndroid.js so they can be
// tested with plain objects (the manifest is the xml2js JSON that `withAndroidManifest` hands over).

/** Same names as src/lib/native/appIcons.ts and TasklyAndroidModule.kt (alias = ".Icon" + capitalised name). */
const ICON_NAMES = ['default', 'dark', 'light'];

/** Background colour of each custom icon (the default one keeps the app's own adaptive icon). Same tokens as the theme:
 *  dark = darkPalette.bg, light = lightPalette.soft. */
const ICON_BACKGROUNDS = { dark: '#171A1D', light: '#E2F1EF' };

const SHORTCUTS_RESOURCE = '@xml/taskly_shortcuts';

const aliasName = (name) => `.Icon${name.charAt(0).toUpperCase()}${name.slice(1)}`;
const iconResource = (name) => (name === 'default' ? '@mipmap/ic_launcher' : `@mipmap/ic_launcher_${name}`);
const colorName = (name) => `taskly_icon_${name}_bg`;

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function findActivity(application, name) {
  return asArray(application.activity).find((activity) => activity.$ && activity.$['android:name'] === name);
}

/** Removes the LAUNCHER category from MAIN filters of the main activity (the aliases are the launcher entries now). */
function removeLauncherCategory(activity) {
  for (const filter of asArray(activity['intent-filter'])) {
    const isMain = asArray(filter.action).some((a) => a.$['android:name'] === 'android.intent.action.MAIN');
    if (!isMain || !filter.category) continue;
    filter.category = asArray(filter.category).filter((c) => c.$['android:name'] !== 'android.intent.category.LAUNCHER');
    if (filter.category.length === 0) delete filter.category;
  }
}

/** SEND text/plain: Taskly shows up in the Android share sheet (share-to-app). Idempotent. */
function addShareFilter(activity) {
  const filters = asArray(activity['intent-filter']);
  const exists = filters.some(
    (filter) =>
      asArray(filter.action).some((a) => a.$['android:name'] === 'android.intent.action.SEND') &&
      asArray(filter.data).some((d) => d.$['android:mimeType'] === 'text/plain'),
  );
  if (!exists) {
    filters.push({
      action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [{ $: { 'android:mimeType': 'text/plain' } }],
    });
  }
  activity['intent-filter'] = filters;
}

function buildAlias(name) {
  return {
    $: {
      'android:name': aliasName(name),
      'android:targetActivity': '.MainActivity',
      'android:enabled': name === 'default' ? 'true' : 'false',
      'android:exported': 'true',
      'android:icon': iconResource(name),
      'android:roundIcon': iconResource(name),
      'android:label': '@string/app_name',
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
    // Static shortcuts belong to the launcher component, which is an alias here.
    'meta-data': [{ $: { 'android:name': 'android.app.shortcuts', 'android:resource': SHORTCUTS_RESOURCE } }],
  };
}

/**
 * Edits the manifest in place: the share filter and the launcher aliases (one per icon, only "default" enabled) with the
 * app shortcuts on them. Running it twice changes nothing more. Throws when the main activity is missing.
 */
function applyTasklyManifest(manifest) {
  const application = asArray(manifest.manifest.application)[0];
  const main = findActivity(application, '.MainActivity');
  if (!main) throw new Error('withTasklyAndroid: .MainActivity not found in AndroidManifest.xml');

  addShareFilter(main);
  const existing = asArray(application['activity-alias']);
  const present = new Set(existing.map((alias) => alias.$['android:name']));
  const added = ICON_NAMES.filter((name) => !present.has(aliasName(name)));
  if (added.length > 0) removeLauncherCategory(main);
  application['activity-alias'] = [...existing, ...added.map(buildAlias)];
  return manifest;
}

/** `res/mipmap-anydpi-v26/ic_launcher_<name>.xml`: the app's adaptive foreground on the icon's own background colour. */
function adaptiveIconXml(name) {
  return `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/${colorName(name)}"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
}

module.exports = {
  ICON_NAMES,
  ICON_BACKGROUNDS,
  SHORTCUTS_RESOURCE,
  aliasName,
  colorName,
  applyTasklyManifest,
  adaptiveIconXml,
};
