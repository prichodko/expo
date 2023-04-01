/**
 * Copyright 2023-present 650 Industries (Expo). All rights reserved.
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { FBSourceFunctionMap, MetroSourceMapSegmentTuple } from 'metro-source-map';
import metroTransformPlugins from 'metro-transform-plugins';
import worker, {
  JsTransformerConfig,
  JsTransformOptions,
  TransformResponse,
} from 'metro-transform-worker';

import { wrapDevelopmentCSS } from './css';
import { matchCssModule, transformCssModuleWeb } from './css-modules';

const { stableHash } = require('metro-cache');
const getCacheKey = require('metro-cache-key') as typeof import('metro-cache-key');
const countLines = require('metro/src/lib/countLines') as typeof import('metro/src/lib/countLines');

type JSFileType = 'js/script' | 'js/module' | 'js/module/asset';

type JsOutput = {
  data: {
    code: string;
    lineCount: number;
    map: MetroSourceMapSegmentTuple[];
    functionMap: FBSourceFunctionMap | null;
  };
  type: JSFileType;
};

/**
 * A custom Metro transformer that adds support for processing Expo-specific bundler features.
 * - Global CSS files on web.
 * - CSS Modules on web.
 * - TODO: Tailwind CSS on web.
 */
module.exports = {
  async transform(
    config: JsTransformerConfig,
    projectRoot: string,
    filename: string,
    data: Buffer,
    options: JsTransformOptions
  ): Promise<TransformResponse> {
    const isCss = options.type !== 'asset' && filename.endsWith('.css');
    // If the file is not CSS, then use the default behavior.
    if (!isCss) {
      return worker.transform(config, projectRoot, filename, data, options);
    }

    // If the platform is not web, then return an empty module.
    if (options.platform !== 'web') {
      const code = matchCssModule(filename) ? 'export default {}' : '';
      return worker.transform(
        config,
        projectRoot,
        filename,
        // TODO: Native CSS Modules
        Buffer.from(code),
        options
      );
    }

    const code = data.toString('utf8');

    // If the file is a CSS Module, then transform it to a JS module
    // in development and a static CSS file in production.
    if (matchCssModule(filename)) {
      const results = await transformCssModuleWeb({
        filename,
        src: code,
        options: {
          projectRoot,
          dev: options.dev,
          minify: options.minify,
          sourceMap: false,
        },
      });

      if (options.dev) {
        // Dev has the CSS appended to the JS file.
        return worker.transform(
          config,
          projectRoot,
          filename,
          Buffer.from(results.output),
          options
        );
      }

      const jsModuleResults = await worker.transform(
        config,
        projectRoot,
        filename,
        Buffer.from(results.output),
        options
      );

      const cssCode = results.css.toString();
      const output: JsOutput[] = [
        {
          data: {
            // @ts-expect-error
            ...jsModuleResults.output[0].data,

            // Append additional css metadata for static extraction.
            css: {
              code: cssCode,
              lineCount: countLines(cssCode),
              map: [],
              functionMap: null,
            },
          },
          // In production, we change the type so it's not included in the JS bundle.
          //   type: 'js/module/css',
          type: 'js/module',
        },
      ];

      return {
        dependencies: jsModuleResults.dependencies,
        output,
      };
    }

    // Global CSS:

    if (options.dev) {
      return worker.transform(
        config,
        projectRoot,
        filename,
        // In development, we use a JS file that appends a style tag to the
        // document. This is necessary because we need to replace the style tag
        // when the CSS changes.
        // NOTE: We may change this to better support static rendering in the future.
        Buffer.from(wrapDevelopmentCSS({ src: code, filename })),
        options
      );
    }

    const { transform } = await import('lightningcss');

    // TODO: Add bundling to resolve imports
    // https://lightningcss.dev/bundling.html#bundling-order

    const cssResults = transform({
      filename,
      code: Buffer.from(code),
      sourceMap: false,
      cssModules: false,
      projectRoot,
      minify: options.minify,
    });

    // TODO: Warnings:
    // cssResults.warnings.forEach((warning) => {
    // });

    // Create a mock JS module that exports an empty object,
    // this ensures Metro dependency graph is correct.
    const jsModuleResults = await worker.transform(
      config,
      projectRoot,
      filename,
      Buffer.from(''),
      options
    );

    const cssCode = cssResults.code.toString();

    // In production, we export the CSS as a string and use a special type to prevent
    // it from being included in the JS bundle. We'll extract the CSS like an asset later
    // and append it to the HTML bundle.
    const output: JsOutput[] = [
      {
        data: {
          // @ts-expect-error
          ...jsModuleResults.output[0].data,

          // Append additional css metadata for static extraction.
          css: {
            code: cssCode,
            lineCount: countLines(cssCode),
            map: [],
            functionMap: null,
          },
        },
        type: 'js/module',
      },
    ];

    return {
      dependencies: jsModuleResults.dependencies,
      output,
    };
  },

  getCacheKey(config: JsTransformerConfig): string {
    const { babelTransformerPath, minifierPath, ...remainingConfig } = config;

    const filesKey = getCacheKey([
      require.resolve(babelTransformerPath),
      require.resolve(minifierPath),
      require.resolve('metro-transform-worker/src/utils/getMinifier'),
      require.resolve('metro-transform-worker/src/utils/assetTransformer'),
      require.resolve('metro/src/ModuleGraph/worker/generateImportNames'),
      require.resolve('metro/src/ModuleGraph/worker/JsFileWrapping'),
      ...metroTransformPlugins.getTransformPluginCacheKeyFiles(),
    ]);

    const babelTransformer = require(babelTransformerPath);
    return [
      filesKey,
      stableHash(remainingConfig).toString('hex'),
      babelTransformer.getCacheKey ? babelTransformer.getCacheKey() : '',
    ].join('$');
  },
};
