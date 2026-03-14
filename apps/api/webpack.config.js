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
const fs = require('fs');
const { dirname, isAbsolute, join, relative } = require('path');
const os = require('os');

const distRoot = join(__dirname, '../../dist');
const outputPath = (() => {
  if (!distRoot.includes('!')) return join(distRoot, 'apps', 'api');

  try {
    const linkCandidates = [
      join(os.tmpdir(), 'notary-portal-dist'),
      join(os.tmpdir(), `notary-portal-dist-${process.pid}`),
    ];

    for (const linkPath of linkCandidates) {
      if (fs.existsSync(linkPath)) {
        const stats = fs.lstatSync(linkPath);
        if (stats.isSymbolicLink()) {
          return join(linkPath, 'apps', 'api');
        }
        continue;
      }

      fs.mkdirSync(dirname(linkPath), { recursive: true });
      fs.symlinkSync(distRoot, linkPath, 'junction');
      return join(linkPath, 'apps', 'api');
    }
  } catch (error) {
    return join(os.tmpdir(), 'notary-portal', 'dist', 'apps', 'api');
  }

  return join(os.tmpdir(), 'notary-portal', 'dist', 'apps', 'api');
})();
const workspaceRoot = join(__dirname, '../..');

const sanitizeLoaderPath = (value, basePath) => {
  if (typeof value !== 'string') return value;
  if (!value.includes('!')) return value;
  if (!isAbsolute(value)) return value;
  const rel = relative(basePath || workspaceRoot, value);
  const normalized = rel.split('\\').join('/');
  return normalized.startsWith('.') ? normalized : `./${normalized}`;
};

const sanitizeUseEntry = (entry, basePath) => {
  if (typeof entry === 'string') return sanitizeLoaderPath(entry, basePath);
  if (entry && typeof entry === 'object' && entry.loader) {
    return { ...entry, loader: sanitizeLoaderPath(entry.loader, basePath) };
  }
  return entry;
};

const sanitizeEntryValue = (value, basePath) => {
  if (typeof value === 'string') return sanitizeLoaderPath(value, basePath);
  if (Array.isArray(value)) return value.map((item) => sanitizeEntryValue(item, basePath));
  if (value && typeof value === 'object' && value.import) {
    return { ...value, import: sanitizeEntryValue(value.import, basePath) };
  }
  return value;
};

const sanitizeEntry = (entry, basePath) => {
  if (!entry) return;
  if (typeof entry === 'function') return;
  if (typeof entry === 'string' || Array.isArray(entry)) {
    return sanitizeEntryValue(entry, basePath);
  }
  if (typeof entry === 'object') {
    Object.keys(entry).forEach((key) => {
      entry[key] = sanitizeEntryValue(entry[key], basePath);
    });
  }
};

const sanitizeRules = (rules, basePath) => {
  if (!Array.isArray(rules)) return;
  rules.forEach((rule) => {
    if (!rule || typeof rule !== 'object') return;
    if (rule.loader) rule.loader = sanitizeLoaderPath(rule.loader, basePath);
    if (rule.use) {
      rule.use = Array.isArray(rule.use)
        ? rule.use.map((entry) => sanitizeUseEntry(entry, basePath))
        : sanitizeUseEntry(rule.use, basePath);
    }
    sanitizeRules(rule.oneOf, basePath);
    sanitizeRules(rule.rules, basePath);
  });
};

class SanitizeLoaderPathsPlugin {
  apply(compiler) {
    const sanitize = () => {
      const basePath = compiler.options?.context || workspaceRoot;
      sanitizeRules(compiler.options?.module?.rules, basePath);
      const entry = sanitizeEntry(compiler.options?.entry, basePath);
      if (entry) compiler.options.entry = entry;
    };
    sanitize();
    compiler.hooks.beforeCompile.tap('SanitizeLoaderPathsPlugin', sanitize);
  }
}

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
    new SanitizeLoaderPathsPlugin(),
  ],
};
