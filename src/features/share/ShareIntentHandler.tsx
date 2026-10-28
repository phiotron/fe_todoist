import { useEffect } from 'react';
import { getTasklyAndroid, type TasklyAndroidModule } from '../../lib/native/tasklyAndroid';
import { buildSharedTask } from '../../lib/share/sharedTask';
import { openQuickAdd } from '../quickAdd/quickAddTarget';

/** Opens Quick Add with the shared text already in (M12 share-to-app). false = nothing to add. */
export function openSharedText(text: string | null | undefined, open: typeof openQuickAdd = openQuickAdd): boolean {
  const task = buildSharedTask(text);
  if (!task) return false;
  open({ content: task.content, ...(task.description ? { description: task.description } : {}) });
  return true;
}

/**
 * Text shared into Taskly (intent filter SEND text/plain, native module): the share that started the app is taken
 * once on mount, later ones arrive through the listener. Mounted in the signed-in layout, so a share made while
 * signed out waits until the user is signed in. Renders nothing; does nothing without the native module.
 */
export function ShareIntentHandler({ module = getTasklyAndroid() }: { module?: TasklyAndroidModule | null }) {
  useEffect(() => {
    if (!module) return;
    openSharedText(module.takeSharedText());
    const subscription = module.addListener('onSharedText', (event) => {
      openSharedText(event.text);
    });
    return () => subscription.remove();
  }, [module]);
  return null;
}
