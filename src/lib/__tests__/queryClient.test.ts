import { ApiError } from '../../api/errors';
import { PERSIST_MAX_AGE_MS, queryClient, shouldRetry } from '../queryClient';

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
