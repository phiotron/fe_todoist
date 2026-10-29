// Expo Go stand-in for expo-notifications' Android TopicSubscriptionModule (see metro.config.js). Same shape as the
// iOS / web variant in expo-notifications/build/TopicSubscriptionModule.js.
module.exports = {
  __esModule: true,
  default: {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null),
  },
};
