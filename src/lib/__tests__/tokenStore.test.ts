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
});
