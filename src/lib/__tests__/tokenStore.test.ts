import * as SecureStore from 'expo-secure-store';
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, tokenStore } from '../tokenStore';

describe('tokenStore', () => {
  beforeEach(async () => {
    await tokenStore.clear();
  });

  it('returns null when nothing is stored', async () => {
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('saves both tokens in SecureStore', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, 'acc-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'ref-1');
    await expect(tokenStore.getAccessToken()).resolves.toBe('acc-1');
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-1');
  });

  it('clear removes both tokens', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    await tokenStore.clear();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    await expect(tokenStore.getAccessToken()).resolves.toBeNull();
    await expect(tokenStore.getRefreshToken()).resolves.toBeNull();
  });

  it('uses key names that are valid for SecureStore', () => {
    expect(ACCESS_TOKEN_KEY).toMatch(/^[\w.-]+$/);
    expect(REFRESH_TOKEN_KEY).toMatch(/^[\w.-]+$/);
  });

  it('persists the new refresh token even if the second write fails', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-old', refreshToken: 'ref-old' });

    // First write goes through; the second one throws.
    const realSet = jest.mocked(SecureStore.setItemAsync).getMockImplementation()!;
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(realSet);
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    await expect(
      tokenStore.setTokens({ accessToken: 'acc-new', refreshToken: 'ref-new' }),
    ).rejects.toThrow('disk full');

    // The rotated refresh token must never be lost (the old one is revoked server-side).
    await expect(tokenStore.getRefreshToken()).resolves.toBe('ref-new');
  });
});
