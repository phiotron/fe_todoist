import { DEFAULT_API_URL, resolveApiUrl } from '../config';

describe('resolveApiUrl', () => {
  it('falls back to the Android emulator address when the env var is missing or blank', () => {
    expect(resolveApiUrl(undefined)).toBe('http://10.0.2.2:8080');
    expect(resolveApiUrl('   ')).toBe(DEFAULT_API_URL);
  });

  it('trims spaces and trailing slashes', () => {
    expect(resolveApiUrl(' http://localhost:8080/ ')).toBe('http://localhost:8080');
  });
});
