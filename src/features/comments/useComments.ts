import { useQuery } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { describeError } from '../../api/describeError';
import { commentsApi, type CommentTarget, type CreateCommentRequest } from '../../api/comments';
import { API_URL } from '../../lib/config';
import { useIdempotencyKeys } from '../../lib/idempotency';
import { useDataMutation } from '../../lib/useDataMutation';
import { useSingleFlight } from '../../lib/useSingleFlight';
import { newUuid } from '../../lib/uuid';
import { useRef } from 'react';

/** Under the "tasks" / "projects" roots, so every write refreshes them (commentCount on task rows follows). */
export const commentsKey = (target: CommentTarget) =>
  [target.kind === 'task' ? 'tasks' : 'projects', 'comments', target.id] as const;
export const mentionableKey = (target: CommentTarget) =>
  [target.kind === 'task' ? 'tasks' : 'projects', 'mentionable', target.id] as const;

export function useComments(target: CommentTarget) {
  return useQuery({ queryKey: commentsKey(target), queryFn: () => commentsApi.list(target) });
}

/** People who can be @mentioned; loaded only when the picker is first needed. */
export function useMentionable(target: CommentTarget, enabled: boolean) {
  return useQuery({ queryKey: mentionableKey(target), queryFn: () => commentsApi.mentionable(target), enabled });
}

/**
 * Send / delete / react. Offline-blocked (useDataMutation). A send keeps ONE client id + Idempotency-Key per draft:
 * a retry after a lost answer returns the same comment instead of a second one (spec 12.11); success starts a new draft.
 */
export function useCommentActions(target: CommentTarget) {
  const keys = useIdempotencyKeys();
  const draftId = useRef<string | null>(null);
  const { run, busy } = useSingleFlight();
  const create = useDataMutation((request: CreateCommentRequest) =>
    commentsApi.create(target, request, keys.keyFor({ ...request, target })),
  );
  const remove = useDataMutation((commentId: string) => commentsApi.remove(commentId));
  const react = useDataMutation(({ commentId, emoji, add }: { commentId: string; emoji: string; add: boolean }) =>
    add ? commentsApi.addReaction(commentId, emoji) : commentsApi.removeReaction(commentId, emoji),
  );

  /** true = sent (the composer clears itself). */
  const send = (request: Omit<CreateCommentRequest, 'id'>) =>
    run(async () => {
      create.reset();
      draftId.current ??= newUuid();
      try {
        await create.mutateAsync({ ...request, id: draftId.current });
        draftId.current = null;
        keys.reset();
        return true;
      } catch {
        return false;
      }
    }).then((sent) => sent === true);

  const deleteOne = (commentId: string) =>
    run(async () => {
      remove.reset();
      try {
        await remove.mutateAsync(commentId);
        return true;
      } catch {
        return false;
      }
    }).then((deleted) => deleted === true);

  const toggleReaction = (commentId: string, emoji: string, add: boolean) =>
    run(async () => {
      react.reset();
      try {
        await react.mutateAsync({ commentId, emoji, add });
      } catch {
        // shown through `error`
      }
    });

  const failure = create.error ?? remove.error ?? react.error;
  return {
    send,
    deleteOne,
    toggleReaction,
    busy,
    deleting: remove.isPending,
    error: failure ? describeError(failure).message : undefined,
    deleteError: remove.error ? describeError(remove.error).message : undefined,
    clearDeleteError: () => remove.reset(),
  };
}

/** Opens an attachment: asks for a fresh signed link (they live 5 minutes), then lets the system open it. */
export async function openAttachment(attachmentId: string): Promise<void> {
  const { url } = await commentsApi.link(attachmentId);
  await Linking.openURL(`${API_URL}${url}`);
}
