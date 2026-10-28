import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { ListRow } from '../../components/ListRow';
import { RadioRow } from '../../components/RadioRow';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useTeamFolders } from './useTeam';

/**
 * "Folder" field of the project form for a team project (M8a, X2): the folder of the team the project is listed under
 * in Team Discovery. Hidden while the team has no folder; `null` = no folder.
 */
export function ProjectFolderField({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string;
  value: string | null;
  onChange: (folderId: string | null) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const folders = useTeamFolders(workspaceId);
  const [open, setOpen] = useState(false);
  const list = folders.data ?? [];
  if (list.length === 0) return null;
  const chosen = list.find((folder) => folder.id === value);

  function pick(folderId: string | null) {
    onChange(folderId);
    setOpen(false);
  }

  return (
    <View>
      <Text style={styles.label}>{t('team.project.folder')}</Text>
      <ListRow
        testID="project-form-folder"
        icon="folder"
        title={chosen ? chosen.name : t('team.project.noFolder')}
        chevron
        onPress={() => setOpen(true)}
      />
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={t('team.project.folderTitle')} testID="project-form-folder-sheet">
        <RadioRow testID="project-form-folder-none" title={t('team.project.noFolder')} selected={value === null} onPress={() => pick(null)} />
        {list.map((folder) => (
          <RadioRow key={folder.id} testID={`project-form-folder-${folder.id}`} title={folder.name} selected={folder.id === value} onPress={() => pick(folder.id)} />
        ))}
      </BottomSheet>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({ label: { ...type.label, color: palette.ink2, marginTop: 4, marginBottom: 4 } });
}
