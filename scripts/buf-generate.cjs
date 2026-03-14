'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const projectRoot = process.argv[2] ?? 'libs/shared/api-contracts';
const root = path.resolve(__dirname, '..');
const cwd = path.resolve(root, projectRoot);
const bufCliPath = require.resolve('@bufbuild/buf/bin/buf');
const pluginPath = require.resolve('@bufbuild/protoc-gen-es/bin/protoc-gen-es');

if (!fs.existsSync(cwd)) {
  throw new Error(`Proto workspace does not exist: ${cwd}`);
}

// Use a temp file so we never modify repo files (avoids triggering Nx file watcher)
const tempConfig = path.join(os.tmpdir(), `buf.gen.${process.pid}.yaml`);
const pluginCommand = [process.execPath, pluginPath].map((value) =>
  value.replaceAll('\\', '/')
);
const bufGenContent = `version: v2
plugins:
  - local: ${JSON.stringify(pluginCommand)}
    out: src/generated
    include_imports: true
    opt:
      - target=ts
      - import_extension=none
`;

try {
  fs.writeFileSync(tempConfig, bufGenContent, 'utf8');
  execFileSync(process.execPath, [bufCliPath, 'generate', '--template', tempConfig], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
} finally {
  try {
    fs.unlinkSync(tempConfig);
  } catch (error) {
    console.error('Failed to remove temp buf config:', tempConfig, error);
  }
}
