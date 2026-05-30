const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  // Пакеты в node_modules часто кладут source maps со ссылками на .ts, которых нет в публикации —
  // source-map-loader пишет «Failed to parse source map / ENOENT»; на сборку это не влияет.
  ignoreWarnings: [/Failed to parse source map/],
  output: {
    path: join(__dirname, '../../dist/apps/api'),
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
      assets: [
        './src/assets',
        {
          input: '../../libs/api/billing/src/lib/payment-receipt',
          glob: 'payment-receipt.template.html',
          output: './',
        },
      ],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
