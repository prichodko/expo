import { MetroConfig } from '@expo/metro-config';
import crypto from 'crypto';
import type { Module } from 'metro';
import { getJsOutput, isJsModule } from 'metro/src/DeltaBundler/Serializers/helpers/js';
import type IncrementalBundler from 'metro/src/IncrementalBundler';
import splitBundleOptions from 'metro/src/lib/splitBundleOptions';
import path from 'path';

// import { getAssetData } from 'metro/src/Assets';
export type ReadOnlyDependencies<T = any> = Map<string, Module<T>>;

type Options = {
  processModuleFilter: (modules: Module) => boolean;
  assetPlugins: readonly string[];
  platform?: string | null;
  projectRoot: string;
  publicPath: string;
};

export type CSSAsset = {
  // 'styles.css'
  originFilename: string;
  // '_expo/css/bc6aa0a69dcebf8e8cac1faa76705756.css'
  filename: string;
  // '\ndiv {\n    background: cyan;\n}\n\n'
  source: string;
};

// s = static
const STATIC_EXPORT_DIRECTORY = '_expo/s/css';

export async function getCssModulesFromBundler(
  config: MetroConfig,
  incrementalBundler: IncrementalBundler,
  options: any
): Promise<CSSAsset[]> {
  if (options.platform !== 'web') {
    return [];
  }

  const { entryFile, onProgress, resolverOptions, transformOptions } = splitBundleOptions(options);

  const dependencies = await incrementalBundler.getDependencies(
    [entryFile],
    transformOptions,
    resolverOptions,
    { onProgress, shallow: false }
  );

  return getCssModules(dependencies, {
    processModuleFilter: config.serializer.processModuleFilter,
    assetPlugins: config.transformer.assetPlugins,
    platform: transformOptions.platform,
    projectRoot: config.server.unstable_serverRoot ?? config.projectRoot,
    publicPath: config.transformer.publicPath,
  });
}

function hashString(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function getCssModules(
  dependencies: ReadOnlyDependencies,
  { processModuleFilter, projectRoot }: Options
) {
  const promises = [];

  for (const module of dependencies.values()) {
    if (
      isJsModule(module) &&
      processModuleFilter(module) &&
      getJsOutput(module).type === 'js/module' &&
      //   getJsOutput(module).type === 'js/module/css' &&
      path.relative(projectRoot, module.path) !== 'package.json'
    ) {
      const cssMetadata = module.output[0]?.data?.css as {
        code: string;
        lineCount: number;
        map: any[];
      };
      if (cssMetadata) {
        const contents = cssMetadata.code;
        const filename = path.join(
          // Consistent location
          STATIC_EXPORT_DIRECTORY,
          // Hashed file contents + name for caching
          hashString(module.path + contents) + '.css'
        );
        promises.push(
          Promise.resolve({
            originFilename: path.relative(projectRoot, module.path),
            filename,
            source: contents,
          })
        );
      }
    }
  }

  return await Promise.all(promises);
}
