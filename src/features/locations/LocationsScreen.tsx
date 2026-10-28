import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { ListRow } from '../../components/ListRow';
import { TextField } from '../../components/TextField';
import { size, type, useTheme } from '../../theme';
import type { Palette } from '../../theme/palette';
import type { LocationResponse } from '../../api/locations';
import { getGeofencePlatform } from './geofencePlatform';
import { coordinateText, DEFAULT_RADIUS_M, validatePlace, type PlaceFormErrors } from './placeForm';
import { useLocationMutations, useLocations } from './useLocations';

/**
 * Settings › Reminders › Places (M12; Todoist "Locations"): the saved places that location reminders refer to. A place
 * is added from the current position or typed coordinates (no map: that needs a Google Maps key). Content only: the
 * route wraps it in SettingsPage.
 */
export function LocationsScreen() {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  const places = useLocations();
  const mutations = useLocationMutations();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState(String(DEFAULT_RADIUS_M));
  const [errors, setErrors] = useState<PlaceFormErrors>({});
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const [toRemove, setToRemove] = useState<LocationResponse | null>(null);

  const reset = () => {
    setAdding(false);
    setName('');
    setLatitude('');
    setLongitude('');
    setRadius(String(DEFAULT_RADIUS_M));
    setErrors({});
    setDenied(false);
  };

  const useCurrent = async () => {
    setLocating(true);
    setDenied(false);
    const platform = getGeofencePlatform();
    let position = await platform.getCurrentPosition();
    if (!position) {
      // Maybe the permission was never asked: ask once, then try again.
      const permission = await platform.requestPermission();
      position = permission === 'denied' ? null : await platform.getCurrentPosition();
    }
    setLocating(false);
    if (!position) {
      setDenied(true);
      return;
    }
    setLatitude(coordinateText(position.latitude));
    setLongitude(coordinateText(position.longitude));
  };

  const save = async () => {
    const result = validatePlace({ name, latitude, longitude, radius });
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    if (await mutations.createPlace(result.request)) reset();
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    const target = toRemove;
    setToRemove(null);
    await mutations.removePlace(target.id);
  };

  const message = (key?: string) => (key ? t(key) : undefined);

  return (
    <View testID="places-screen">
      <Text style={styles.hint}>{t('reminders.places.intro')}</Text>
      {(places.data ?? []).length === 0 && !places.isPending ? (
        <Text testID="places-empty" style={styles.empty}>
          {t('reminders.places.empty')}
        </Text>
      ) : null}
      {(places.data ?? []).map((place) => (
        <ListRow
          key={place.id}
          icon="map-pin"
          title={`${place.name} · ${t('reminders.places.radiusValue', { count: place.radius })}`}
          right={
            <Pressable
              testID={`place-remove-${place.id}`}
              accessibilityRole="button"
              accessibilityLabel={t('reminders.places.remove', { name: place.name })}
              onPress={() => setToRemove(place)}
              style={styles.remove}
            >
              <Feather name="trash-2" size={size.icon} color={palette.mute} />
            </Pressable>
          }
        />
      ))}

      {adding ? (
        <View testID="place-form" style={styles.form}>
          <TextField
            testID="place-name"
            label={t('reminders.places.name')}
            value={name}
            onChangeText={setName}
            error={message(errors.name)}
          />
          <AppButton
            testID="place-use-current"
            variant="outline"
            label={locating ? t('reminders.places.locating') : t('reminders.places.useCurrent')}
            disabled={locating}
            onPress={() => void useCurrent()}
          />
          {denied ? (
            <View style={styles.denied}>
              <Text testID="place-location-denied" style={styles.hint}>
                {t('reminders.places.locationDenied')}
              </Text>
              <AppButton
                testID="place-open-settings"
                variant="outline"
                size="sm"
                label={t('reminders.places.openSystemSettings')}
                onPress={() => void Linking.openSettings().catch(() => undefined)}
              />
            </View>
          ) : null}
          <TextField
            testID="place-latitude"
            label={t('reminders.places.latitude')}
            value={latitude}
            onChangeText={setLatitude}
            keyboardType="numbers-and-punctuation"
            error={message(errors.latitude)}
          />
          <TextField
            testID="place-longitude"
            label={t('reminders.places.longitude')}
            value={longitude}
            onChangeText={setLongitude}
            keyboardType="numbers-and-punctuation"
            error={message(errors.longitude)}
          />
          <TextField
            testID="place-radius"
            label={t('reminders.places.radius')}
            value={radius}
            onChangeText={setRadius}
            keyboardType="number-pad"
            error={message(errors.radius)}
          />
          <ErrorText testID="place-error" message={mutations.error} />
          <View style={styles.actions}>
            <AppButton testID="place-cancel" variant="ghost" label={t('reminders.places.cancel')} onPress={reset} />
            <AppButton
              testID="place-save"
              label={t('reminders.places.save')}
              busy={mutations.busy}
              requiresOnline
              onPress={() => void save()}
            />
          </View>
        </View>
      ) : (
        <AppButton
          testID="place-add"
          variant="outline"
          full
          label={t('reminders.places.add')}
          onPress={() => setAdding(true)}
        />
      )}

      <Text style={styles.hint}>{t('reminders.places.backgroundHint')}</Text>
      {adding ? null : <ErrorText testID="place-list-error" message={mutations.error} />}

      <ConfirmDialog
        visible={toRemove !== null}
        title={t('reminders.places.removeConfirmTitle')}
        message={toRemove ? t('reminders.places.removeConfirmMessage', { name: toRemove.name }) : undefined}
        confirmLabel={t('reminders.places.removeConfirm')}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setToRemove(null)}
        testID="place-remove-dialog"
      />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    hint: { ...type.meta, color: palette.mute, marginVertical: 8 },
    empty: { ...type.body, color: palette.mute, paddingVertical: 12 },
    remove: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
    form: { gap: 8, marginTop: 12 },
    denied: { gap: 8 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  });
}
