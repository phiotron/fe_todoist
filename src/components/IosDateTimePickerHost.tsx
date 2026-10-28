import RNDateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { setDateTimePickerHost, type DateTimePickerRequest } from '../lib/dateTimePicker';
import { isIos } from '../lib/native/platform';
import { useTheme } from '../theme';
import { AppButton } from './AppButton';
import { DialogFrame } from './DialogFrame';

function eventOf(type: 'set' | 'dismissed', date: Date): DateTimePickerEvent {
  return { type, nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } } as DateTimePickerEvent;
}

/**
 * iOS only (X5): the date / time picker behind openDateTimePicker(). Mounted once in the root layout; on other
 * platforms it renders nothing and registers nothing, so Android keeps the native dialog. Cancel / closing reports
 * "dismissed", Done reports "set" with the chosen date, as the Android dialog does.
 */
export function IosDateTimePickerHost({ os }: { os?: string }) {
  const ios = isIos(os);
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const [request, setRequest] = useState<DateTimePickerRequest | null>(null);
  const [value, setValue] = useState<Date>(() => new Date());

  const open = useCallback((next: DateTimePickerRequest) => {
    setValue(next.value);
    setRequest(next);
  }, []);

  useEffect(() => {
    if (!ios) return;
    setDateTimePickerHost({ open });
    return () => setDateTimePickerHost(null);
  }, [ios, open]);

  if (!ios) return null;

  function finish(type: 'set' | 'dismissed') {
    const current = request;
    setRequest(null);
    current?.onChange(eventOf(type, value), type === 'set' ? value : undefined);
  }

  return (
    <DialogFrame
      visible={request !== null}
      title={request?.mode === 'time' ? t('schedule.time') : t('schedule.title')}
      onRequestClose={() => finish('dismissed')}
      testID="ios-date-time-picker"
    >
      {request ? (
        <RNDateTimePicker
          testID="ios-date-time-picker-input"
          value={value}
          mode={request.mode}
          display={request.mode === 'date' ? 'inline' : 'spinner'}
          themeVariant={scheme}
          onChange={(_event, picked) => {
            if (picked) setValue(picked);
          }}
        />
      ) : null}
      <View style={styles.actions}>
        <AppButton variant="outline" label={t('common.cancel')} onPress={() => finish('dismissed')} testID="ios-date-time-picker-cancel" />
        <AppButton label={t('common.done')} onPress={() => finish('set')} testID="ios-date-time-picker-done" />
      </View>
    </DialogFrame>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
