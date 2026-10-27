import { Feather } from '@expo/vector-icons';
import type { Project } from '../../api/models';
import { palette, size as sizes } from '../../theme';
import { projectColorHex } from './appearance';

/** Design: "#" in the project colour (projects have no user-chosen icon, spec 10.1); the Inbox tray in the accent. */
export function ProjectIcon({
  project,
  size = sizes.icon,
  testID,
}: {
  project: Pick<Project, 'color' | 'isInbox'>;
  size?: number;
  testID?: string;
}) {
  return project.isInbox ? (
    <Feather testID={testID} name="inbox" size={size} color={palette.acc} />
  ) : (
    <Feather testID={testID} name="hash" size={size} color={projectColorHex(project.color)} />
  );
}
