import { QueryClient, onlineManager } from '@tanstack/react-query';
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
