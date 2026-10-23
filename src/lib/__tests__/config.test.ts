import { DEFAULT_API_URL, resolveApiUrl } from '../config';

describe('resolveApiUrl', () => {
  // Android 17 blocks apps from 10.0.2.2 (local network); dev uses `adb reverse tcp:8080 tcp:8080` + localhost.
  it('falls back to localhost (reached through adb reverse) when the env var is missing or blank', () => {
    expect(resolveApiUrl(undefined)).toBe('http://localhost:8080');
    expect(resolveApiUrl('   ')).toBe(DEFAULT_API_URL);
  });

  it('trims spaces and trailing slashes', () => {
    expect(resolveApiUrl(' http://localhost:8080/ ')).toBe('http://localhost:8080');
  });
});
