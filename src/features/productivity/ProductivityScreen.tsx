import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type ProductivityDaily, type ProductivityKarma, type ProductivityWeekly } from '../../api/productivity';
import { AppButton } from '../../components/AppButton';
import { ListRow } from '../../components/ListRow';
import { QueryStateView } from '../../components/QueryStateView';
import { Segmented } from '../../components/Segmented';
import { SubHeader } from '../../components/SubHeader';
import { formatDateKey, weekdayShort } from '../../lib/dates/format';
import { gutter, type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { GoalSheet } from './GoalSheet';
import { MiniBars, type MiniBar } from './MiniBars';
import { ProgressBar } from './ProgressBar';
import {
  DAILY_GOAL_CHOICES,
  WEEKLY_GOAL_CHOICES,
  barRatios,
  progressRatio,
  remaining,
  trendRatios,
  withCurrent,
} from './productivityModel';
import { useGoalEditor } from './useGoalEditor';
import { useProductivity } from './useProductivity';

type Tab = 'daily' | 'weekly' | 'karma';

/**
 * Productivity (M10, design M-Productivity): tabs Daily / Weekly / Karma over ONE request (GET productivity).
 * Edit goal saves through me/settings. The Karma tab is hidden when the user turned Karma off.
 */
export function ProductivityScreen() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const query = useProductivity();
  const saveGoal = useGoalEditor();
  const [tab, setTab] = useState<Tab>('daily');
  const [editing, setEditing] = useState<'daily' | 'weekly' | null>(null);
  const data = query.data;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: t('productivity.tabs.daily') },
    { key: 'weekly', label: t('productivity.tabs.weekly') },
  ];
  if (data?.karmaEnabled !== false) tabs.push({ key: 'karma', label: t('productivity.tabs.karma') });
  const active: Tab = tabs.some((candidate) => candidate.key === tab) ? tab : 'daily';

  return (
    <View style={styles.fill} testID="productivity-screen">
      <SubHeader title={t('productivity.title')} onBack={() => router.back()} testID="productivity-header" />
      {!data ? (
        <QueryStateView query={query} testID="productivity-state" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />}
        >
          <Segmented options={tabs} value={active} onChange={setTab} testID="productivity-tabs" />
          {active === 'daily' ? <DailyTab daily={data.daily} onEdit={() => setEditing('daily')} /> : null}
          {active === 'weekly' ? <WeeklyTab weekly={data.weekly} onEdit={() => setEditing('weekly')} /> : null}
          {active === 'karma' && data.karma ? <KarmaTab karma={data.karma} /> : null}
        </ScrollView>
      )}
      {data ? (
        <>
          <GoalSheet
            visible={editing === 'daily'}
            title={t('productivity.goal.dailyTitle')}
            choices={withCurrent(DAILY_GOAL_CHOICES, data.dailyGoal)}
            value={data.dailyGoal}
            onSelect={(goal) => saveGoal({ dailyGoal: goal })}
            onClose={() => setEditing(null)}
            testID="daily-goal-sheet"
          />
          <GoalSheet
            visible={editing === 'weekly'}
            title={t('productivity.goal.weeklyTitle')}
            choices={withCurrent(WEEKLY_GOAL_CHOICES, data.weeklyGoal)}
            value={data.weeklyGoal}
            onSelect={(goal) => saveGoal({ weeklyGoal: goal })}
            onClose={() => setEditing(null)}
            testID="weekly-goal-sheet"
          />
        </>
      ) : null}
    </View>
  );
}

function GoalCard({
  title,
  done,
  goal,
  reached,
  hint,
  onEdit,
  testID,
}: {
  title: string;
  done: number;
  goal: number;
  reached: boolean;
  hint: string;
  onEdit: () => void;
  testID: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID={testID}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.big} testID={`${testID}-progress`}>
        {t('productivity.daily.progress', { done, goal })}
      </Text>
      <ProgressBar ratio={progressRatio(done, goal)} testID={`${testID}-bar`} />
      <Text style={[styles.hint, reached && styles.ok]} testID={`${testID}-hint`}>
        {hint}
      </Text>
      <AppButton variant="outline" size="sm" label={t('productivity.goal.edit')} onPress={onEdit} testID={`${testID}-edit`} />
    </View>
  );
}

function StreakRow({ current, longest, unit }: { current: number; longest: number; unit: 'days' | 'weeks' }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const key = unit === 'days' ? 'productivity.streak.days' : 'productivity.streak.weeks';
  return (
    <View style={styles.streakRow} testID="streak">
      <View style={styles.streakCol}>
        <Text style={styles.streakLabel}>{t('productivity.streak.current')}</Text>
        <Text style={styles.streakValue} testID="streak-current">
          {t(key, { n: current })}
        </Text>
      </View>
      <View style={styles.streakCol}>
        <Text style={styles.streakLabel}>{t('productivity.streak.longest')}</Text>
        <Text style={styles.streakValue} testID="streak-longest">
          {t(key, { n: longest })}
        </Text>
      </View>
    </View>
  );
}

function DailyTab({ daily, onEdit }: { daily: ProductivityDaily; onEdit: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const ratios = barRatios(
    daily.days.map((day) => day.completed),
    daily.goal,
  );
  const bars: MiniBar[] = daily.days.map((day, index) => ({
    key: day.date,
    label: weekdayShort(day.date),
    ratio: ratios[index],
    muted: (day.dayOff || day.vacation) && day.completed < daily.goal,
    strong: day.completed >= daily.goal,
    accessibilityLabel: `${weekdayShort(day.date)}: ${day.completed}${day.dayOff ? ` (${t('productivity.daily.dayOff')})` : ''}${day.vacation ? ` (${t('productivity.daily.vacation')})` : ''}`,
  }));
  return (
    <View style={styles.tab} testID="productivity-daily">
      <GoalCard
        testID="daily-goal"
        title={t('productivity.daily.goalTitle')}
        done={daily.completed}
        goal={daily.goal}
        reached={daily.reached}
        hint={daily.reached ? t('productivity.daily.reached') : t('productivity.daily.remaining', { n: remaining(daily.completed, daily.goal) })}
        onEdit={onEdit}
      />
      <StreakRow current={daily.currentStreak} longest={daily.longestStreak} unit="days" />
      <Text style={styles.sectionTitle}>{t('productivity.daily.last7')}</Text>
      <MiniBars bars={bars} testID="daily-bars" />
    </View>
  );
}

function WeeklyTab({ weekly, onEdit }: { weekly: ProductivityWeekly; onEdit: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const ratios = barRatios(
    weekly.weeks.map((week) => week.completed),
    weekly.goal,
  );
  const bars: MiniBar[] = weekly.weeks.map((week, index) => ({
    key: week.weekStart,
    label: formatDateKey(week.weekStart, false),
    ratio: ratios[index],
    strong: week.completed >= weekly.goal,
    accessibilityLabel: `${t('productivity.weekly.weekOf', { date: formatDateKey(week.weekStart, false) })}: ${week.completed}`,
  }));
  return (
    <View style={styles.tab} testID="productivity-weekly">
      <GoalCard
        testID="weekly-goal"
        title={t('productivity.weekly.goalTitle')}
        done={weekly.completed}
        goal={weekly.goal}
        reached={weekly.reached}
        hint={weekly.reached ? t('productivity.weekly.reached') : t('productivity.weekly.remaining', { n: remaining(weekly.completed, weekly.goal) })}
        onEdit={onEdit}
      />
      <StreakRow current={weekly.currentStreak} longest={weekly.longestStreak} unit="weeks" />
      <Text style={styles.sectionTitle}>{t('productivity.weekly.last4')}</Text>
      <MiniBars bars={bars} testID="weekly-bars" />
    </View>
  );
}

function KarmaTab({ karma }: { karma: ProductivityKarma }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const levelName = (level: string) => t(`productivity.levels.${level}`);
  const nextMin = karma.nextLevelKarma;
  const currentMin = karma.levels.find((entry) => entry.level === karma.level)?.minKarma ?? 0;
  const ratio = nextMin === null ? 1 : progressRatio(karma.karma - currentMin, nextMin - currentMin);
  const ratios = trendRatios(karma.trend);
  const bars: MiniBar[] = karma.trend.map((point, index) => ({
    key: point.date,
    label: index % 7 === 0 ? formatDateKey(point.date, false) : '',
    ratio: ratios[index],
    strong: index === karma.trend.length - 1,
    accessibilityLabel: `${formatDateKey(point.date, false)}: ${point.karma}`,
  }));
  return (
    <View style={styles.tab} testID="productivity-karma">
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('productivity.karma.level', { level: levelName(karma.level) })}</Text>
        <Text style={styles.big} testID="karma-score">
          {t('productivity.karma.score', { n: karma.karma })}
        </Text>
        <ProgressBar ratio={ratio} testID="karma-bar" />
        <Text style={styles.hint} testID="karma-next">
          {karma.nextLevel
            ? t('productivity.karma.toNext', { n: karma.pointsToNextLevel, level: levelName(karma.nextLevel) })
            : t('productivity.karma.maxLevel')}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>{t('productivity.karma.trend')}</Text>
      <MiniBars bars={bars} testID="karma-trend" />
      <ListRow
        testID="karma-about"
        title={t('productivity.karma.aboutLevels')}
        icon="info"
        chevron
        onPress={() => router.push('/karma-levels')}
      />
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    fill: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: gutter, paddingBottom: 40, gap: 16 },
    tab: { gap: 16, marginTop: 8 },
    card: { backgroundColor: palette.bg2, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: palette.line },
    cardTitle: { ...type.label, color: palette.ink2 },
    big: { ...type.screenTitle, color: palette.ink },
    hint: { ...type.meta, color: palette.mute },
    ok: { color: palette.ok },
    sectionTitle: { ...type.section, color: palette.ink },
    streakRow: { flexDirection: 'row', gap: 12 },
    streakCol: { flex: 1, backgroundColor: palette.soft, borderRadius: 12, padding: 12, gap: 4 },
    streakLabel: { ...type.meta, color: palette.ink2 },
    streakValue: { ...type.bodyStrong, color: palette.acc2 },
  });
}
