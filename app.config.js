// Dynamic part of the Expo config. Every static value lives in app.json (Expo passes it in as `config`); this file only
// adds what depends on the environment (X5: the Google Sign-In URL scheme for iOS). Never put secrets here.
const { withOptionalGoogleSignIn } = require('./plugins/optionalGoogleSignIn');

module.exports = ({ config }) => withOptionalGoogleSignIn(config);
