import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAuthImageSource } from '../lib/useAuthImageSource';
import { AVATAR_COLORS, fonts, size, useThemedStyles, useTheme } from '../theme';
import type { Palette } from '../theme/palette';

const SIZES = { s: size.avatarS, m: size.avatar, l: size.avatarL, xl: size.avatarXL } as const;
const FONT = { s: 10, m: 12, l: 15, xl: 22 } as const;

/** First letter of the first and the last word, upper case; "?" when empty. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

function colorFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** .av: round initials on one of the 5 avatar colours (stable per user). Read as an image named after the user, not as the bare initials. */
export function Avatar({
  name,
  seed,
  size: avatarSize = 'm',
  testID,
  uri,
}: {
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
  testID?: string;
  /** M8b: API path of the profile picture (UserResponse.avatarUrl); the initials show while it loads or when it fails. */
  uri?: string | null;
}) {
  const styles = useThemedStyles(createAvatarStyles);
  const { palette } = useTheme();
  const dimension = SIZES[avatarSize];
  const source = useAuthImageSource(uri);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = source !== null && failedUri !== source.uri;
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.circle, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: colorFor(seed) }]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: FONT[avatarSize], color: palette.onacc }}>{initialsOf(name)}</Text>
      {showImage ? (
        <Image
          testID={testID ? `${testID}-image` : undefined}
          source={source}
          accessibilityIgnoresInvertColors
          onError={() => setFailedUri(source.uri)}
          style={[StyleSheet.absoluteFill, { borderRadius: dimension / 2 }]}
        />
      ) : null}
    </View>
  );
}

function createAvatarStyles(palette: Palette) {
  return StyleSheet.create({ circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
}
