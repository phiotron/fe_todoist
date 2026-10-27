import { quickAddTargetFor, type QuickAddContext, type QuickAddParams } from '../quickAdd/quickAddTarget';

/** "/today" → "today" (expo-router hides the "(app)/(tabs)" group segments from the pathname). */
export function routeOfPath(pathname: string): string {
  return pathname.replace(/^\/+/, '').split('/')[0] ?? '';
}

/** Params for the + button on the screen at `pathname`; a past day viewed in Upcoming falls back to today. */
export function fabParamsFor(pathname: string, ctx: QuickAddContext): QuickAddParams {
  const upcomingDay = ctx.upcomingDay && ctx.upcomingDay >= ctx.today ? ctx.upcomingDay : undefined;
  return quickAddTargetFor(routeOfPath(pathname), { ...ctx, upcomingDay });
}
