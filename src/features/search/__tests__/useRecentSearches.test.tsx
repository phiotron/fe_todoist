import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { recentSearchesStorageKey } from '../recentSearches';
import { useRecentSearches } from '../useRecentSearches';

const stored = async (userId: string) => AsyncStorage.getItem(recentSearchesStorageKey(userId));

describe('useRecentSearches', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads the list stored for the user', async () => {
    await AsyncStorage.setItem(recentSearchesStorageKey('u-1'), JSON.stringify(['họp', 'mua']));
    const { result } = await renderHook(() => useRecentSearches('u-1'));
    await waitFor(() => expect(result.current.items).toEqual(['họp', 'mua']));
  });

  it('remembers newest first and stores it for that user only', async () => {
    const { result } = await renderHook(() => useRecentSearches('u-1'));
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      result.current.remember(' a ');
    });
    await act(async () => {
      result.current.remember('b');
    });

    expect(result.current.items).toEqual(['b', 'a']);
    await waitFor(async () => expect(await stored('u-1')).toBe(JSON.stringify(['b', 'a'])));
    expect(await stored('u-2')).toBeNull();
  });

  it('removes one and clears all', async () => {
    await AsyncStorage.setItem(recentSearchesStorageKey('u-1'), JSON.stringify(['a', 'b']));
    const { result } = await renderHook(() => useRecentSearches('u-1'));
    await waitFor(() => expect(result.current.items).toEqual(['a', 'b']));

    await act(async () => {
      result.current.remove('a');
    });
    expect(result.current.items).toEqual(['b']);

    await act(async () => {
      result.current.clear();
    });
    expect(result.current.items).toEqual([]);
    await waitFor(async () => expect(await stored('u-1')).toBe('[]'));
  });

  it('merges a term remembered before the stored list arrived', async () => {
    await AsyncStorage.setItem(recentSearchesStorageKey('u-1'), JSON.stringify(['old']));
    const { result } = await renderHook(() => useRecentSearches('u-1'));
    await act(async () => {
      result.current.remember('new');
    });
    await waitFor(() => expect(result.current.items).toEqual(['new', 'old']));
  });

  it('keeps the list in memory only when there is no user', async () => {
    const { result } = await renderHook(() => useRecentSearches(undefined));
    await act(async () => {
      result.current.remember('a');
    });
    expect(result.current.items).toEqual(['a']);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  });
});
