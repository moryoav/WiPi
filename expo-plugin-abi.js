// expo-plugin-abi.js
// Automatically configure APK splits to build only arm64-v8a
const { withAppBuildGradle } = require('expo/config-plugins');

// Define separate ABI build flag at project level
const ENABLE_DEF = `def enableSeparateBuildPerCPUArchitecture = true`;

// Splits configuration snippet to include only arm64-v8a
const SPLITS_SNIPPET = `
    splits {
        abi {
            reset()
            enable enableSeparateBuildPerCPUArchitecture
            include "arm64-v8a"
            universalApk false
        }
    }
`;

module.exports = function withArm64Splits(config) {
  return withAppBuildGradle(config, (mod) => {
    let src = typeof mod.modResults === 'string'
      ? mod.modResults
      : mod.modResults.contents;

    // 1) Inject enableSeparateBuildPerCPUArchitecture flag before android block
    if (!src.includes('enableSeparateBuildPerCPUArchitecture')) {
      src = src.replace(
        /(android\s*\{)/,
        `${ENABLE_DEF}\n$1`
      );
    }

    // 2) Inject splits snippet immediately after defaultConfig block
    if (!src.includes('splits {')) {
      const defaultConfigClose = /defaultConfig\s*\{[\s\S]*?\n\s*\}/;
      src = src.replace(
        defaultConfigClose,
        match => `${match}\n${SPLITS_SNIPPET}`
      );
    }

    // Write back the modified build.gradle
    if (typeof mod.modResults === 'string') {
      mod.modResults = src;
    } else {
      mod.modResults.contents = src;
    }
    return mod;
  });
};
