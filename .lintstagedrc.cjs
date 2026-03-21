'use strict';

const path = require('node:path');

// Quote path for shell (Windows-safe)
function q(p) {
  const s = path.normalize(p).replaceAll('\\', '/');
  return `"${s}"`;
}

module.exports = {
  '**/*.{html,ts,tsx,js,jsx}': (filenames) => {
    const eslint = filenames.map((f) => `eslint --fix ${q(f)}`);
    const prettier = filenames.map((f) => `prettier --write ${q(f)}`);
    return [...eslint, ...prettier];
  },
  '**/*.{css,scss}': (filenames) => {
    const stylelint = filenames.map((f) => `stylelint --fix ${q(f)}`);
    const prettier = filenames.map((f) => `prettier --write ${q(f)}`);
    return [...stylelint, ...prettier];
  },
  '**/*.{json,yml,yaml,md}': (filenames) =>
    filenames.map((f) => `prettier --write ${q(f)}`),
  '**/*.proto': (filenames) => {
    const ours = filenames.filter(
      (f) => !path.normalize(f).replaceAll('\\', '/').includes('/vendor/')
    );
    const format = ours.map((f) => `buf format --write ${q(f)}`);
    const lint = ours.map((f) => `buf lint ${q(f)}`);
    return [...format, ...lint];
  },
  '**/*.prisma': (filenames) =>
    filenames.map((f) => `prisma format --schema=${q(f)}`),
};
