import { QueryClient, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { ApiError, NetworkError, OfflineError } from '../../api/errors';
import { PERSIST_MAX_AGE_MS, assertOnline, persistOptions, queryClient, shouldRetry } from '../queryClient';

describe('shouldRetry', () => {
  it('never retries 4xx API errors', () => {
    expect(shouldRetry(0, new ApiError({ status: 404, title: 'Not Found' }))).toBe(false);
    expect(shouldRetry(0, new ApiError({ status: 401, title: 'Unauthorized' }))).toBe(false);
  });

  it('retries 5xx and network errors up to two times', () => {
    expect(shouldRetry(0, new ApiError({ status: 503, title: 'Unavailable' }))).toBe(true);
    expect(shouldRetry(1, new Error('Network request failed'))).toBe(true);
    expect(shouldRetry(2, new Error('Network request failed'))).toBe(false);
  });
});

describe('queryClient', () => {
  it('keeps cached data at least as long as the persisted cache lives', () => {
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBeGreaterThanOrEqual(PERSIST_MAX_AGE_MS);
  });
});

describe('query lifetimes (PERF3)', () => {
  it('results that are never persisted leave memory after 5 minutes; everything else keeps the day', () => {
    expect(queryClient.getQueryDefaults(['search', 'tasks', { q: 'a' }]).gcTime).toBe(5 * 60 * 1000);
    expect(queryClient.getQueryDefaults(['activity', 'list', {}]).gcTime).toBe(5 * 60 * 1000);
    expect(queryClient.getQueryDefaults(['tasks', 'list', {}]).gcTime).toBeUndefined();
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(PERSIST_MAX_AGE_MS);
  });
});

describe('offline writes (spec 5.6)', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('runs mutations immediately and never retries them', () => {
    expect(queryClient.getDefaultOptions().mutations).toMatchObject({ networkMode: 'always', retry: false });
  });

  it('never persists mutations to disk', () => {
    expect(persistOptions.dehydrateOptions.shouldDehydrateMutation()).toBe(false);
    expect(persistOptions.maxAge).toBe(PERSIST_MAX_AGE_MS);
  });

  it('assertOnline throws OfflineError (a NetworkError) only while offline', () => {
    expect(() => assertOnline()).not.toThrow();
    onlineManager.setOnline(false);
    expect(() => assertOnline()).toThrow(OfflineError);
    expect(new OfflineError()).toBeInstanceOf(NetworkError);
  });

  it('a write fired offline fails at once and is not sent again when the network returns', async () => {
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    const send = jest.fn(async () => {
      assertOnline();
      return 'sent';
    });
    onlineManager.setOnline(false);

    const mutation = client.getMutationCache().build(client, { mutationFn: send });
    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(OfflineError);

    onlineManager.setOnline(true);
    await new Promise((done) => setImmediate(done));
    expect(send).toHaveBeenCalledTimes(1);
    expect(mutation.state.status).toBe('error');
  });
});

describe('app foreground (focusManager)', () => {
  it('follows AppState so queries refetch when the app returns to the foreground', () => {
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    try {
      // The listener is installed when the module loads, so load a fresh copy with the spy in place.
      jest.isolateModules(() => {
        const query = require('@tanstack/react-query') as typeof import('@tanstack/react-query');
        require('../queryClient');
        expect(spy).toHaveBeenCalledWith('change', expect.any(Function));
        const onChange = spy.mock.calls[0]![1] as (state: string) => void;
        onChange('background');
        expect(query.focusManager.isFocused()).toBe(false);
        onChange('active');
        expect(query.focusManager.isFocused()).toBe(true);
        // iOS "inactive" (Control Center, Face ID, share sheet) is not a trip to the background: it must not
        // flip focus, otherwise coming back from it fires a pointless refetch of every stale query.
        const focusEvents = jest.fn();
        const unsubscribe = query.focusManager.subscribe(focusEvents);
        onChange('inactive');
        onChange('active');
        expect(focusEvents).not.toHaveBeenCalled();
        expect(query.focusManager.isFocused()).toBe(true);
        onChange('background');
        expect(query.focusManager.isFocused()).toBe(false);
        unsubscribe();
      });
    } finally {
      spy.mockRestore();
    }
  });
});
