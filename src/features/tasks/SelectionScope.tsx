import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SelectionBar } from './SelectionBar';
import { TaskSelectionProvider } from './selection';

/** Wrap a task screen: its rows can be long-pressed into the multi-select mode, the action bars float on top. */
export function SelectionScope({ children }: { children: ReactNode }) {
  return (
    <TaskSelectionProvider>
      <View style={styles.fill}>
        {children}
        <SelectionBar />
      </View>
    </TaskSelectionProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
