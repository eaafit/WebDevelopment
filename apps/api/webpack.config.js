const Module = require('module');
const path = require('path');
const os = require('os');

const loaderRequests = new Set(['ts-loader', 'swc-loader', 'source-map-loader']);
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (
    loaderRequests.has(request) &&
    parent?.filename?.includes(`${path.sep}@nx${path.sep}webpack`)
  ) {
    return request;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

const defaultOutputPath = join(__dirname, '../../dist/apps/api');
const outputPath = defaultOutputPath.includes('!')
  ? join(os.tmpdir(), 'notary-portal-dist', 'api')
  : defaultOutputPath;
const enableSourceMap = !defaultOutputPath.includes('!');

module.exports = {
  output: {
    path: outputPath,
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      buildLibsFromSource: true,
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: enableSourceMap,
    }),
  ],
};
