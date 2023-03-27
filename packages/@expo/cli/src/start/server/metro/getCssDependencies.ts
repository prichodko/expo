import type { Module, AssetData } from 'metro';
import { getAssetData } from 'metro/src/Assets';
import { getJsOutput, isJsModule } from 'metro/src/DeltaBundler/Serializers/helpers/js';

import path from 'path';

export type ReadOnlyDependencies<T = any> = Map<string, Module<T>>;

type Options = {
  readonly processModuleFilter: (module: Module<unknown>) => boolean;
  assetPlugins: readonly string[];
  platform?: string | null;
  projectRoot: string;
  publicPath: string;
};

export async function getCssModules(
  dependencies: ReadOnlyDependencies<unknown>,
  { processModuleFilter, projectRoot, assetPlugins, platform, publicPath }: Options
): Promise<readonly AssetData[]> {
  const promises = [];

  for (const module of dependencies.values()) {
    if (
      isJsModule(module) &&
      processModuleFilter(module) &&
      getJsOutput(module).type === 'js/module/css' &&
      path.relative(projectRoot, module.path) !== 'package.json'
    ) {
      promises.push(
        getCssData(
          module.path,
          path.relative(projectRoot, module.path),
          assetPlugins,
          platform,
          publicPath
        )
      );
    }
  }

  return await Promise.all(promises);
}

async function getCssData(
  assetPath: string,
  localPath: string,
  assetDataPlugins: readonly string[],
  platform: string | null | undefined,
  publicPath: string
) {
  // If the path of the asset is outside of the projectRoot, we don't want to
  // use `path.join` since this will generate an incorrect URL path. In that
  // case we just concatenate the publicPath with the relative path.
  let assetUrlPath = localPath.startsWith('..')
    ? publicPath.replace(/\/$/, '') + '/' + path.dirname(localPath)
    : path.join(publicPath, path.dirname(localPath));

  // On Windows, change backslashes to slashes to get proper URL path from file path.
  if (path.sep === '\\') {
    assetUrlPath = assetUrlPath.replace(/\\/g, '/');
  }

  //   const isImage = isAssetTypeAnImage(path.extname(assetPath).slice(1));
  //   const assetInfo = await getAbsoluteAssetInfo(assetPath, platform);

  //   const isImageInput = assetInfo.files[0].includes('.zip/')
  //     ? fs.readFileSync(assetInfo.files[0])
  //     : assetInfo.files[0];
  //   const dimensions = isImage ? imageSize(isImageInput) : null;
  //   const scale = assetInfo.scales[0];

  return {
    __packager_asset: true,
    fileSystemLocation: path.dirname(assetPath),
    httpServerLocation: assetUrlPath,
    // width: dimensions ? dimensions.width / scale : undefined,
    // height: dimensions ? dimensions.height / scale : undefined,
    // scales: assetInfo.scales,
    // files: assetInfo.files,
    // hash: assetInfo.hash,
    // name: assetInfo.name,
    // type: assetInfo.type,
  };
}
