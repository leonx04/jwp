// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Cho phép import file migration .sql của Drizzle
config.resolver.sourceExts.push('sql');

module.exports = config;
