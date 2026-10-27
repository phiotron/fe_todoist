import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { pinTargetsApi, type PinOption } from '../../api/pinTargets';
import { useSession } from '../auth/session';
import type { KnownTargets, PinKind, PinTarget } from './navTabsModel';

const ALL_KINDS: readonly PinKind[] = ['project', 'label', 'filter'];
const STALE_MS = 30_000;

export interface PinTargetsState {
  options: Record<PinKind, PinOption[]>;
  /** A kind is in here only after its list loaded; a missing kind means "not known", so stored values are trusted. */
  known: KnownTargets;
  /** true once the kind has answered (success or error), or was not asked for. */
  settled: Record<PinKind, boolean>;
  /** Name of a pinned target, or null when it is not in the loaded list. */
  nameOf(pin: PinTarget): string | null;
}

/** Projects / labels / filters that can be pinned or used as start page; fetches only the requested kinds. */
export function usePinTargets(kinds: readonly PinKind[] = ALL_KINDS): PinTargetsState {
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const projects = useQuery({
    queryKey: ['pinTargets', 'projects'],
    queryFn: pinTargetsApi.projects,
    enabled: signedIn && kinds.includes('project'),
    staleTime: STALE_MS,
  });
  const labels = useQuery({
    queryKey: ['pinTargets', 'labels'],
    queryFn: pinTargetsApi.labels,
    enabled: signedIn && kinds.includes('label'),
    staleTime: STALE_MS,
  });
  const filters = useQuery({
    queryKey: ['pinTargets', 'filters'],
    queryFn: pinTargetsApi.filters,
    enabled: signedIn && kinds.includes('filter'),
    staleTime: STALE_MS,
  });

  const asked = useMemo(() => new Set(kinds), [kinds]);
  const projectData = projects.data;
  const labelData = labels.data;
  const filterData = filters.data;

  const options = useMemo<Record<PinKind, PinOption[]>>(
    () => ({ project: projectData ?? [], label: labelData ?? [], filter: filterData ?? [] }),
    [projectData, labelData, filterData],
  );
  const known = useMemo<KnownTargets>(() => {
    const result: KnownTargets = {};
    if (projectData) result.project = new Set(projectData.map((item) => item.id));
    if (labelData) result.label = new Set(labelData.map((item) => item.id));
    if (filterData) result.filter = new Set(filterData.map((item) => item.id));
    return result;
  }, [projectData, labelData, filterData]);
  const settled: Record<PinKind, boolean> = {
    project: !signedIn || !asked.has('project') || projects.isSuccess || projects.isError,
    label: !signedIn || !asked.has('label') || labels.isSuccess || labels.isError,
    filter: !signedIn || !asked.has('filter') || filters.isSuccess || filters.isError,
  };
  const nameOf = useCallback(
    (pin: PinTarget) => options[pin.kind].find((item) => item.id === pin.id)?.name ?? null,
    [options],
  );
  return { options, known, settled, nameOf };
}
