"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const metro_transform_plugins_1 = __importDefault(require("metro-transform-plugins"));
const metro_transform_worker_1 = __importDefault(require("metro-transform-worker"));
const css_1 = require("./css");
const css_modules_1 = require("./css-modules");
const { stableHash } = require('metro-cache');
const getCacheKey = require('metro-cache-key');
const countLines = require('metro/src/lib/countLines');
// TODO: Tailwind support goes here...
module.exports = {
    async transform(config, projectRoot, filename, data, options) {
        const isCss = options.type !== 'asset' && filename.endsWith('.css');
        if (!isCss) {
            return metro_transform_worker_1.default.transform(config, projectRoot, filename, data, options);
        }
        if (options.platform !== 'web') {
            const code = (0, css_modules_1.matchCssModule)(filename) ? 'export default {}' : '';
            return metro_transform_worker_1.default.transform(config, projectRoot, filename, 
            // TODO: Native CSS Modules
            Buffer.from(code), options);
        }
        const code = data.toString('utf8');
        if ((0, css_modules_1.matchCssModule)(filename)) {
            const results = await (0, css_modules_1.transformCssModuleWeb)({
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
                return metro_transform_worker_1.default.transform(config, projectRoot, filename, Buffer.from(results.output), options);
            }
            const jsModuleResults = await metro_transform_worker_1.default.transform(config, projectRoot, filename, Buffer.from(results.output), options);
            const cssCode = results.css.toString();
            const output = [
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
            return metro_transform_worker_1.default.transform(config, projectRoot, filename, 
            // In development, we use a JS file that appends a style tag to the
            // document. This is necessary because we need to replace the style tag
            // when the CSS changes.
            // NOTE: We may change this to better support static rendering in the future.
            Buffer.from((0, css_1.wrapDevelopmentCSS)({ src: code, filename })), options);
        }
        const { transform } = await Promise.resolve().then(() => __importStar(require('lightningcss')));
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
        const jsModuleResults = await metro_transform_worker_1.default.transform(config, projectRoot, filename, Buffer.from(''), options);
        const cssCode = cssResults.code.toString();
        // In production, we export the CSS as a string and use a special type to prevent
        // it from being included in the JS bundle. We'll extract the CSS like an asset later
        // and append it to the HTML bundle.
        const output = [
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
    getCacheKey(config) {
        const { babelTransformerPath, minifierPath, ...remainingConfig } = config;
        const filesKey = getCacheKey([
            require.resolve(babelTransformerPath),
            require.resolve(minifierPath),
            require.resolve('metro-transform-worker/src/utils/getMinifier'),
            require.resolve('metro-transform-worker/src/utils/assetTransformer'),
            require.resolve('metro/src/ModuleGraph/worker/generateImportNames'),
            require.resolve('metro/src/ModuleGraph/worker/JsFileWrapping'),
            ...metro_transform_plugins_1.default.getTransformPluginCacheKeyFiles(),
        ]);
        const babelTransformer = require(babelTransformerPath);
        return [
            filesKey,
            stableHash(remainingConfig).toString('hex'),
            babelTransformer.getCacheKey ? babelTransformer.getCacheKey() : '',
        ].join('$');
    },
};
