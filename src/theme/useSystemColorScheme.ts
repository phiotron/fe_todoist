import { useColorScheme } from 'react-native';

/** Thin wrapper so tests can fake the OS colour scheme without touching react-native internals. */
export function useSystemColorScheme(): string | null | undefined {
  return useColorScheme();
}
