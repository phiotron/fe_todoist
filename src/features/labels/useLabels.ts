import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { isNotFound } from '../../api/describeError';
import { labelsApi, type CreateLabelRequest, type Label, type UpdateLabelRequest } from '../../api/labels';
import type { AddOrRemoveLabelsAction } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';
import { tasksApi } from '../../api/tasks';
import { useDataMutation } from '../../lib/useDataMutation';

const NO_LABELS: Label[] = [];

/**
 * Every label of the user in sort order — a hard-limited list loaded in one request (spec BR-12).
 * `enabled = false` keeps screens that may not need labels from sending the request.
 */
export function useLabels(enabled = true) {
  const query = useQuery({ queryKey: queryKeys.labels.list(), queryFn: labelsApi.list, enabled });
  return { query, labels: query.data ?? NO_LABELS };
}

/** id → label, for rows and chips that only hold label ids. */
export function useLabelMap(enabled = true): ReadonlyMap<string, Label> {
  const { labels } = useLabels(enabled);
  return useMemo(() => new Map(labels.map((label) => [label.id, label])), [labels]);
}

export const useCreateLabel = () =>
  useDataMutation(({ body, idempotencyKey }: { body: CreateLabelRequest; idempotencyKey: string }) =>
    labelsApi.create(body, idempotencyKey),
  );

export const useUpdateLabel = () =>
  useDataMutation(({ id, body }: { id: string; body: UpdateLabelRequest }) => labelsApi.update(id, body));

/** Spec 5.6: deleting something already gone (404) counts as deleted. */
export const useDeleteLabel = () =>
  useDataMutation(async (id: string) => {
    try {
      await labelsApi.remove(id);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  });

export const useSetLabelFavorite = () =>
  useDataMutation(({ id, favorite }: { id: string; favorite: boolean }) => labelsApi.setFavorite(id, favorite));

export const useReorderLabel = () =>
  useDataMutation(({ id, afterId }: { id: string; afterId: string | null }) => labelsApi.reorder(id, afterId));

/** Multi-select → Label: ONE tasks/batch request for the whole selection, always with an Idempotency-Key (spec 12.5, 12.11). */
export const useBatchLabels = () =>
  useDataMutation(
    ({
      action,
      taskIds,
      labelIds,
      idempotencyKey,
    }: {
      action: AddOrRemoveLabelsAction;
      taskIds: readonly string[];
      labelIds: readonly string[];
      idempotencyKey: string;
    }) => tasksApi.batch({ action, taskIds: [...taskIds], labelIds: [...labelIds] }, idempotencyKey),
  );
