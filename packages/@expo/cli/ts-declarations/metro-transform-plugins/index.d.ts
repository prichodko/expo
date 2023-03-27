declare module 'metro-transform-plugins' {
  function getTransformPluginCacheKeyFiles(): string[];

  module.exports = getTransformPluginCacheKeyFiles;
}
