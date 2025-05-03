// expo-plugin-cleartext.js
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (mod) => {
    const manifestJson = mod.modResults;      // root JSON

    // Ensure the <application> array exists inside <manifest>
    if (
      !manifestJson.manifest.application ||
      !Array.isArray(manifestJson.manifest.application)
    ) {
      manifestJson.manifest.application = [{}];
    } else if (manifestJson.manifest.application.length === 0) {
      manifestJson.manifest.application.push({});
    }

    // Add / overwrite the attribute
    const app = manifestJson.manifest.application[0];
    app.$ = app.$ || {};
    app.$['android:usesCleartextTraffic'] = 'true';

    return mod;
  });
};
