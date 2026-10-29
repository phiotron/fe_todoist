import { appendFileSync } from 'fs';
import { Profiler, type ProfilerOnRenderCallback, type ReactElement } from 'react';

/**
 * PERF4 measuring kit. Counts what a screen costs without a device:
 *  - `hooks.*`: calls of useQuery / useInfiniteQuery / useMutation (one per mounted hook, every render),
 *  - `hooks.render`: calls of useTranslation = about one per component render (almost every component asks for `t`),
 *  - `netInfo`: NetInfo.addEventListener subscriptions (one per useIsOnline caller before PERF4),
 *  - Profiler: commits + actualDuration (ms, Node not Hermes: only the ratio before / after is meaningful).
 * Use with:  jest.mock('@tanstack/react-query', () => require('<path>/test/perf4').wrapReactQuery(...));
 *            jest.mock('react-i18next', () => require('<path>/test/perf4').wrapI18next(...));
 */
export const hooks = { useQuery: 0, useInfiniteQuery: 0, useMutation: 0, render: 0 };

export function wrapReactQuery(actual: typeof import('@tanstack/react-query')) {
  return {
    ...actual,
    useQuery: (...args: Parameters<typeof actual.useQuery>) => {
      hooks.useQuery += 1;
      return (actual.useQuery as (...a: unknown[]) => unknown)(...args);
    },
    useInfiniteQuery: (...args: Parameters<typeof actual.useInfiniteQuery>) => {
      hooks.useInfiniteQuery += 1;
      return (actual.useInfiniteQuery as (...a: unknown[]) => unknown)(...args);
    },
    useMutation: (...args: Parameters<typeof actual.useMutation>) => {
      hooks.useMutation += 1;
      return (actual.useMutation as (...a: unknown[]) => unknown)(...args);
    },
  };
}

export function wrapI18next(actual: typeof import('react-i18next')) {
  return {
    ...actual,
    useTranslation: (...args: Parameters<typeof actual.useTranslation>) => {
      hooks.render += 1;
      return actual.useTranslation(...args);
    },
  };
}

export function resetHooks(): void {
  hooks.useQuery = 0;
  hooks.useInfiniteQuery = 0;
  hooks.useMutation = 0;
  hooks.render = 0;
}

export interface Measure {
  commits: number;
  ms: number;
}
const box = { commits: 0, ms: 0 };
const onRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
  box.commits += 1;
  box.ms += actualDuration;
};
export function resetMeasure(): void {
  box.commits = 0;
  box.ms = 0;
  resetHooks();
}
export function readMeasure(): Measure & typeof hooks {
  return { commits: box.commits, ms: Math.round(box.ms * 10) / 10, ...hooks };
}
export function profiled(ui: ReactElement): ReactElement {
  return (
    <Profiler id="perf4" onRender={onRender}>
      {ui}
    </Profiler>
  );
}

/** One line into $PERF4_OUT (when set): "<label>\t<scenario>\t{...}". */
export function record(scenario: string, data: object): void {
  const line = `${process.env.PERF4_LABEL ?? 'run'}\t${scenario}\t${JSON.stringify(data)}\n`;
  if (process.env.PERF4_OUT) appendFileSync(process.env.PERF4_OUT, line);
}
