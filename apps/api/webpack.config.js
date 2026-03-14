const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');
const os = require('os');

const defaultOutputPath = join(__dirname, '../../dist/apps/api');
const outputPath = defaultOutputPath.includes('!')
  ? join(os.tmpdir(), 'notary-portal-dist', 'api')
  : defaultOutputPath;

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
      sourceMap: true,
    }),
  ],
};
