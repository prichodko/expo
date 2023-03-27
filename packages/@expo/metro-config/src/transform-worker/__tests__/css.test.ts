import { getHotReplaceTemplate, wrapDevelopmentCSS, pathToHtmlSafeName } from '../css';

describe(wrapDevelopmentCSS, () => {
  it(`should transform css in dev mode`, async () => {
    const result = await wrapDevelopmentCSS({
      filename: 'test.css',
      src: 'body { color: red; }',
    });

    expect(result).toMatchSnapshot();

    expect(result).toMatch(/expo-css-hmr/);
  });

  it(`should transform css in prod mode`, async () => {
    const result = await wrapDevelopmentCSS({
      filename: 'test.css',
      src: 'body { color: red; }',
    });

    expect(result).toMatchSnapshot();

    expect(result).not.toMatch(/expo-css-hmr/);
  });

  it(`should skip transforming css modules`, async () => {
    const result = await wrapDevelopmentCSS({
      filename: 'test.module.css',
      src: 'body { color: red; }',
    });

    expect(result).toEqual('module.exports = {}');
  });

  it(`should shim css on native`, async () => {
    const result = await wrapDevelopmentCSS({
      filename: 'test.css',
      src: 'body { color: red; }',
    });

    expect(result).toEqual('');
  });
  it(`should shim css on native with comment in dev`, async () => {
    const result = await wrapDevelopmentCSS({
      filename: 'test.css',
      src: 'body { color: red; }',
    });

    expect(result).toMatchSnapshot();
  });
});

describe(pathToHtmlSafeName, () => {
  it(`converts filepath to safe name`, () => {
    expect(pathToHtmlSafeName('foo')).toEqual('foo');
    expect(pathToHtmlSafeName('../123/abc/something.module.css')).toEqual(
      '___123_abc_something_module_css'
    );
  });
});

describe(getHotReplaceTemplate, () => {
  it(`should generate the correct template`, () => {
    expect(getHotReplaceTemplate('foo')).toMatchSnapshot();
  });
});
