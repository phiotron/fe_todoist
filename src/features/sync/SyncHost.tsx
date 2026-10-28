import { useEffect } from 'react';
import { startSync } from '../../lib/sync/runtime';

/** Mounted by the signed-in layout: runs the M9 offline queue and sync engine while the user is signed in. Renders nothing. */
export function SyncHost() {
  useEffect(() => startSync(), []);
  return null;
}
