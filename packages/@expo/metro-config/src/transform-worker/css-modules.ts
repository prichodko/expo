import { BabelTransformerArgs } from 'metro-babel-transformer';

import { wrapDevelopmentCSS } from './css';

export async function transformCssModuleWeb(props: {
  filename: string;
  src: string;
  options: { projectRoot: string; minify: boolean; dev: boolean; sourceMap: boolean };
}) {
  const { transform } = await import('lightningcss');

  // TODO: Add bundling to resolve imports
  // https://lightningcss.dev/bundling.html#bundling-order

  const cssResults = transform({
    filename: props.filename,
    code: Buffer.from(props.src),
    sourceMap: props.options.sourceMap,
    cssModules: {
      // Prevent renaming CSS variables to ensure
      // variables created in global files are available.
      dashedIdents: false,
    },
    // cssModules: true,
    projectRoot: props.options.projectRoot,
    minify: props.options.minify,
  });
  const codeAsString = cssResults.code.toString();

  const runtimeCss = wrapDevelopmentCSS({
    ...props,
    src: codeAsString,
  });

  const { styles, variables } = convertLightningCssToReactNativeWebStyleSheet(cssResults.exports!);

  let outputModule = [
    // "import { StyleSheet } from 'react-native';",
    // `const styles = StyleSheet.create(${JSON.stringify(styles)});`,
    `module.exports = Object.assign(${JSON.stringify(styles)}, ${JSON.stringify(variables)});`,
    // "import { StyleSheet } from 'react-native';",
    // `const styles = StyleSheet.create(${JSON.stringify(styles)});`,
    // `export default { ...styles, ...${JSON.stringify(variables)} };`,
  ].join('\n');

  if (props.options.dev) {
    outputModule += '\n' + runtimeCss;
  }

  return {
    output: outputModule,
    css: cssResults.code,
    map: cssResults.map,
  };
}

export function convertLightningCssToReactNativeWebStyleSheet(
  input: import('lightningcss').CSSModuleExports
) {
  const styles: Record<string, any> = {};
  const variables: Record<string, string> = {};
  // e.g. { container: { name: 'ahs8IW_container', composes: [], isReferenced: false }, }
  Object.entries(input).map(([key, value]) => {
    // order matters here
    let className = value.name;

    if (value.composes.length) {
      className += ' ' + value.composes.map((value) => value.name).join(' ');
    }

    // CSS Variables will be `{string: string}`
    if (key.startsWith('--')) {
      variables[key] = className;
    }

    styles[key] = { $$css: true, c: className };
    return {
      [key]: { $$css: true, c: className },
    };
  });

  return { styles, variables };
}

export async function transformCssModuleNative(
  props: BabelTransformerArgs
): Promise<BabelTransformerArgs> {
  // TODO: Native
  props.src = 'export default ' + JSON.stringify({});
  return props;
}

export async function transformCssModule(
  props: BabelTransformerArgs
): Promise<BabelTransformerArgs> {
  if (!matchCssModule(props.filename)) return props;

  if (props.options.platform === 'web') {
    return transformCssModuleWeb(props);
  }
  return transformCssModuleNative(props);
}

export function matchCssModule(filePath: string): boolean {
  return !!/\.module(\.(native|ios|android|web))?\.css$/.test(filePath);
}
