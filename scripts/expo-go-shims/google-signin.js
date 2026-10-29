// Expo Go stand-in for @react-native-google-signin/google-signin (see metro.config.js). Only what
// src/lib/googleSignInAdapter.ts uses; signing in always fails with a plain error, which the adapter reports as "failed".
const unavailable = () => Promise.reject(new Error('Google Sign-In is not available in Expo Go (needs a development build)'));

module.exports = {
  GoogleSignin: {
    configure: () => {},
    hasPlayServices: () => Promise.resolve(true),
    signIn: unavailable,
    signOut: () => Promise.resolve(null),
  },
  isErrorWithCode: () => false,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};
