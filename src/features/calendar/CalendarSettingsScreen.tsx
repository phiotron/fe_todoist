import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text } from 'react-native';
import { calendarApi, type CalendarProvider, type CalendarStatusResponse } from '../../api/calendar';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { formatDate, formatTime } from '../../lib/dates/displayFormat';
import { openExternalUrl } from '../../lib/externalBrowser';
import { useIsOnline } from '../../lib/useIsOnline';
import { useTheme } from '../../theme';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, SuccessText, SwitchRow, useSettingsStyles } from '../settings/ui';
import { describeCalendarError, describeConnectDeepLinkError } from './calendarErrors';
import { calendarKeys, useCalendarStatus } from './useCalendar';

type Message = { kind: 'error' | 'info'; text: string };

interface CalendarSettingsScreenProps {
  /** From taskly://calendar/connected: `result=connected` or `error=<code>`; shown once as a message. */
  result?: string;
  error?: string;
}

/** "05/11/2026 14:30" in the device's local time, in the user's date / time format. */
function formatSyncedAt(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatDate(key, true)} ${formatTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}`;
}

/**
 * Settings > Calendar (M13b): connect Google / Outlook (one provider, one account), show events, "Sync tasks to calendar",
 * and the calendar feed link. Connecting opens the browser; the answer comes back through the deep link
 * taskly://calendar/connected (route src/app/calendar/connected.tsx), which returns here.
 */
export function CalendarSettingsScreen({ result, error }: CalendarSettingsScreenProps) {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { palette } = useTheme();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const status = useCalendarStatus();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [confirming, setConfirming] = useState<'disconnect' | 'resetFeed' | null>(null);
  const [dialogError, setDialogError] = useState<string>();
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

  async function run(action: () => Promise<Message | null>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
      return true;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const refreshAll = () => queryClient.invalidateQueries({ queryKey: calendarKeys.all });

  const onConnect = (provider: CalendarProvider) =>
    run(async (): Promise<Message | null> => {
      try {
        const { authorizationUrl } = await calendarApi.connect(provider);
        const opened = await openExternalUrl(authorizationUrl);
        return opened
          ? { kind: 'info', text: t('calendar.opening') }
          : { kind: 'error', text: t('calendar.errors.openFailed') };
      } catch (caught) {
        return { kind: 'error', text: describeCalendarError(caught, isOnline) };
      }
    });

  const onToggle = (patch: { showEvents?: boolean; syncTasks?: boolean }) =>
    run(async (): Promise<Message | null> => {
      try {
        const next = await calendarApi.update(patch);
        queryClient.setQueryData<CalendarStatusResponse>(calendarKeys.status, next);
        await queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
        return null;
      } catch (caught) {
        return { kind: 'error', text: describeCalendarError(caught, isOnline) };
      }
    });

  const onSync = () =>
    run(async (): Promise<Message | null> => {
      try {
        const synced = await calendarApi.sync();
        await refreshAll();
        return { kind: 'info', text: t('calendar.syncResult', { ...synced }) };
      } catch (caught) {
        return { kind: 'error', text: describeCalendarError(caught, isOnline) };
      }
    });

  const onCopyFeed = (reset: boolean) =>
    run(async (): Promise<Message | null> => {
      try {
        const feed = reset ? await calendarApi.resetFeed() : await calendarApi.feed();
        await Clipboard.setStringAsync(feed.url);
        return { kind: 'info', text: t(reset ? 'calendar.feed.resetDone' : 'calendar.feed.copied') };
      } catch (caught) {
        return { kind: 'error', text: describeCalendarError(caught, isOnline) };
      }
    });

  async function onConfirm() {
    const action = confirming;
    setDialogError(undefined);
    if (action === 'disconnect') {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await calendarApi.disconnect();
        await refreshAll();
        setConfirming(null);
        setMessage({ kind: 'info', text: t('calendar.disconnected') });
      } catch (caught) {
        setDialogError(describeCalendarError(caught, isOnline));
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    } else if (action === 'resetFeed') {
      setConfirming(null);
      await onCopyFeed(true);
    }
  }

  const data = status.data;
  const providerLabel = data?.provider ? t(`calendar.providers.${data.provider}`) : '';
  const deepLinkMessage: Message | null = error
    ? { kind: 'error', text: describeConnectDeepLinkError(error) }
    : result === 'connected'
      ? { kind: 'info', text: t('calendar.connectedResult') }
      : null;
  const shown = message ?? deepLinkMessage;

  return (
    <SettingsPage testID="calendar-settings-screen" title={t('calendar.title')}>
      {status.isPending ? <ActivityIndicator testID="calendar-loading" color={palette.acc} /> : null}
      {status.isError ? <ErrorText testID="calendar-load-error" message={describeError(status.error).message} /> : null}

      {data && !data.connected ? (
        <SettingsSection testID="calendar-section-connect" title={t('calendar.title')}>
          <Text style={styles.hint}>{t('calendar.intro')}</Text>
          <AppButton
            testID="calendar-connect-google"
            variant="outline"
            full
            label={t('calendar.connectGoogle')}
            busy={busy}
            requiresOnline
            onPress={() => void onConnect('GOOGLE')}
          />
          <AppButton
            testID="calendar-connect-outlook"
            variant="outline"
            full
            label={t('calendar.connectOutlook')}
            busy={busy}
            requiresOnline
            onPress={() => void onConnect('OUTLOOK')}
          />
        </SettingsSection>
      ) : null}

      {data?.connected ? (
        <SettingsSection testID="calendar-section-connected" title={t('calendar.connectedAs', { provider: providerLabel })}>
          <Text testID="calendar-account" style={styles.body}>
            {t('calendar.account')}: {data.accountEmail ?? providerLabel}
          </Text>
          {data.needsReauth ? <ErrorText testID="calendar-needs-reauth" message={t('calendar.needsReauth')} /> : null}
          <SwitchRow
            testID="calendar-toggle-events"
            label={t('calendar.showEvents')}
            hint={t('calendar.showEventsHint')}
            value={data.showEvents}
            disabled={busy || data.needsReauth}
            onChange={(showEvents) => void onToggle({ showEvents })}
          />
          <SwitchRow
            testID="calendar-toggle-sync"
            label={t('calendar.syncTasks')}
            hint={t('calendar.syncTasksHint')}
            value={data.syncTasks}
            disabled={busy || data.needsReauth}
            onChange={(syncTasks) => void onToggle({ syncTasks })}
          />
          {data.syncTasks ? (
            <>
              <Text testID="calendar-last-synced" style={styles.hint}>
                {data.lastSyncedAt
                  ? t('calendar.lastSynced', { time: formatSyncedAt(data.lastSyncedAt) })
                  : t('calendar.neverSynced')}
              </Text>
              <AppButton
                testID="calendar-sync-now"
                variant="outline"
                full
                label={t('calendar.syncNow')}
                busy={busy}
                disabled={data.needsReauth}
                requiresOnline
                onPress={() => void onSync()}
              />
            </>
          ) : null}
          <AppButton
            testID="calendar-disconnect"
            variant="outline"
            full
            label={t('calendar.disconnect')}
            disabled={busy}
            requiresOnline
            onPress={() => {
              setDialogError(undefined);
              setConfirming('disconnect');
            }}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection testID="calendar-section-feed" title={t('calendar.feed.title')}>
        <Text style={styles.hint}>{t('calendar.feed.description')}</Text>
        <AppButton
          testID="calendar-feed-copy"
          variant="outline"
          full
          label={t('calendar.feed.copy')}
          busy={busy}
          requiresOnline
          onPress={() => void onCopyFeed(false)}
        />
        <AppButton
          testID="calendar-feed-reset"
          variant="outline"
          full
          label={t('calendar.feed.reset')}
          disabled={busy}
          requiresOnline
          onPress={() => setConfirming('resetFeed')}
        />
      </SettingsSection>

      {shown?.kind === 'error' ? <ErrorText testID="calendar-message" message={shown.text} /> : null}
      {shown?.kind === 'info' ? <SuccessText testID="calendar-message" text={shown.text} /> : null}

      <ConfirmDialog
        testID="calendar-confirm"
        visible={confirming !== null}
        title={t(confirming === 'resetFeed' ? 'calendar.feed.resetTitle' : 'calendar.disconnectTitle')}
        message={t(confirming === 'resetFeed' ? 'calendar.feed.resetMessage' : 'calendar.disconnectMessage')}
        confirmLabel={t(confirming === 'resetFeed' ? 'calendar.feed.resetConfirm' : 'calendar.disconnect')}
        destructive={confirming === 'disconnect'}
        busy={busy}
        error={dialogError}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(null)}
      />
    </SettingsPage>
  );
}
