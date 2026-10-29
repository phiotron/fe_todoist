const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const GOOGLE = '@react-native-google-signin/google-signin';
const NOTIF_ORIGIN = path.join(ROOT, 'node_modules', 'expo-notifications', 'build', 'topicSubscription.js');

function loadConfig(flag) {
  const saved = process.env.EXPO_GO_SHIMS;
  if (flag === undefined) delete process.env.EXPO_GO_SHIMS;
  else process.env.EXPO_GO_SHIMS = flag;
  try {
    let config;
    jest.isolateModules(() => {
      config = require('../../metro.config.js');
    });
    return config;
  } finally {
    if (saved === undefined) delete process.env.EXPO_GO_SHIMS;
    else process.env.EXPO_GO_SHIMS = saved;
  }
}

function resolve(config, name, platform, originModulePath = path.join(ROOT, 'src', 'app', '_layout.tsx')) {
  const fallback = jest.fn(() => ({ type: 'sourceFile', filePath: `default:${name}` }));
  const context = { originModulePath, resolveRequest: fallback };
  return { result: config.resolver.resolveRequest(context, name, platform), fallback };
}

describe('metro.config.js Expo Go shims (test-only)', () => {
  it('without the flag leaves the default resolver alone', () => {
    const config = loadConfig(undefined);
    expect(config.resolver.resolveRequest ?? null).toBeNull();
  });

  describe('with EXPO_GO_SHIMS=1', () => {
    const config = loadConfig('1');

    it('swaps Google Sign-In (native module absent from Expo Go) for a stub on both platforms', () => {
      for (const platform of ['android', 'ios']) {
        const { result, fallback } = resolve(config, GOOGLE, platform);
        expect(result.type).toBe('sourceFile');
        expect(result.filePath).toContain(path.join('scripts', 'expo-go-shims', 'google-signin.js'));
        expect(fallback).not.toHaveBeenCalled();
      }
    });

    it('swaps the Android-only push topic module of expo-notifications, only on android', () => {
      const android = resolve(config, './TopicSubscriptionModule', 'android', NOTIF_ORIGIN);
      expect(android.result.filePath).toContain(path.join('scripts', 'expo-go-shims', 'push-topic-module.js'));
      const ios = resolve(config, './TopicSubscriptionModule', 'ios', NOTIF_ORIGIN);
      expect(ios.fallback).toHaveBeenCalled();
    });

    it('does not touch a same-named module imported from elsewhere', () => {
      const { fallback } = resolve(config, './TopicSubscriptionModule', 'android', path.join(ROOT, 'src', 'x.ts'));
      expect(fallback).toHaveBeenCalled();
    });

    it('passes every other module to the default resolver', () => {
      const { result, fallback } = resolve(config, 'react-native', 'android');
      expect(fallback).toHaveBeenCalledWith(expect.anything(), 'react-native', 'android');
      expect(result.filePath).toBe('default:react-native');
    });
  });
});

describe('Expo Go shim stubs', () => {
  it('google-signin stub exposes what googleSignInAdapter uses and refuses to sign in', async () => {
    const stub = require('../../scripts/expo-go-shims/google-signin.js');
    expect(typeof stub.GoogleSignin.configure).toBe('function');
    expect(typeof stub.GoogleSignin.hasPlayServices).toBe('function');
    expect(typeof stub.GoogleSignin.signOut).toBe('function');
    expect(typeof stub.isErrorWithCode).toBe('function');
    expect(stub.statusCodes.SIGN_IN_CANCELLED).toBeDefined();
    await expect(stub.GoogleSignin.signIn()).rejects.toThrow(/Expo Go/);
    expect(stub.isErrorWithCode(new Error('x'))).toBe(false);
  });

  it('push topic stub resolves like the iOS/web module of expo-notifications', async () => {
    const stub = require('../../scripts/expo-go-shims/push-topic-module.js').default;
    await expect(stub.subscribeToTopicAsync('t')).resolves.toBeNull();
    await expect(stub.unsubscribeFromTopicAsync('t')).resolves.toBeNull();
    expect(() => stub.addListener()).not.toThrow();
    expect(() => stub.removeListeners()).not.toThrow();
  });
});
