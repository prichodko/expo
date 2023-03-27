declare module 'metro-cache-key' {
  function getCacheKey(files: string[]): string;
  module.exports = getCacheKey;
  export default getCacheKey;
}
