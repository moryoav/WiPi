// expo-plugin-bouncycastle.js
const { withAppBuildGradle } = require('expo/config-plugins');

const SNIPPET = `
// --- AVOID BOUNCY-CASTLE DUPLICATES -----------------------------------------
configurations.all {
    exclude group: 'org.bouncycastle', module: 'bcprov-jdk15to18'
    resolutionStrategy {
        force 'org.bouncycastle:bcprov-jdk15on:1.70'
    }
}
// ---------------------------------------------------------------------------
`;

module.exports = function withBouncyCastle(config) {
  return withAppBuildGradle(config, (mod) => {
    let src = typeof mod.modResults === 'string' ? mod.modResults : mod.modResults.contents;
    if (!src.includes('bcprov-jdk15on:1.70')) {
      src += `\n${SNIPPET.trim()}\n`;
    }
    if (typeof mod.modResults === 'string') {
      mod.modResults = src;
    } else {
      mod.modResults.contents = src;
    }
    return mod;
  });
};
