import { usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTasklyAndroid, type TasklyAndroidModule } from '../../lib/native/tasklyAndroid';
import { buildSharedComment, destinationFromPath, type ShareDestination } from '../../lib/share/shareDestination';
import { buildSharedTask } from '../../lib/share/sharedTask';
import { openQuickAdd } from '../quickAdd/quickAddTarget';
import { SharedContentSheet } from './SharedContentSheet';

/** Opens Quick Add with the shared text already in (M12 share-to-app). false = nothing to add. */
export function openSharedText(text: string | null | undefined, open: typeof openQuickAdd = openQuickAdd): boolean {
  const task = buildSharedTask(text);
  if (!task) return false;
  open({ content: task.content, ...(task.description ? { description: task.description } : {}) });
  return true;
}

interface PendingShare {
  /** Distinguishes two shares in a row (a new share starts the sheet again). */
  id: number;
  text: string;
  /** The task / project on screen when the share arrived. */
  current: ShareDestination | null;
}

/**
 * Text shared into Taskly (intent filter SEND text/plain, native module): the share that started the app is taken
 * once on mount, later ones arrive through the listener. X4: each share opens a sheet that asks "Create task" (Quick
 * Add, as in M12) or "Add to comment" (the open task / project, or one picked). Mounted in the signed-in layout, so a
 * share made while signed out waits until the user is signed in. Does nothing without the native module.
 */
export function ShareIntentHandler({ module = getTasklyAndroid() }: { module?: TasklyAndroidModule | null }) {
  const [pending, setPending] = useState<PendingShare | null>(null);
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const counter = useRef(0);

  const receive = useCallback((text: string | null | undefined) => {
    const content = buildSharedComment(text);
    if (content === null) return;
    counter.current += 1;
    setPending({ id: counter.current, text: content, current: destinationFromPath(pathRef.current) });
  }, []);

  useEffect(() => {
    if (!module) return;
    receive(module.takeSharedText());
    const subscription = module.addListener('onSharedText', (event) => {
      receive(event.text);
    });
    return () => subscription.remove();
  }, [module, receive]);

  if (!pending) return null;
  return (
    <SharedContentSheet
      key={pending.id}
      text={pending.text}
      currentDestination={pending.current}
      onCreateTask={() => {
        setPending(null);
        openSharedText(pending.text);
      }}
      onClose={() => setPending(null)}
    />
  );
}
