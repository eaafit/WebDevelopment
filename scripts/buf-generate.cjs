'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// Run from cwd = libs/shared/api-contracts; workspace root is ../../..
const cwd = process.cwd();
const root = path.resolve(cwd, '..', '..', '..');
const isWin = process.platform === 'win32';
const pluginPath = path.join(root, 'node_modules', '.bin', isWin ? 'protoc-gen-es.cmd' : 'protoc-gen-es');
const bufScript = path.join(root, 'node_modules', '@bufbuild', 'buf', 'bin', 'buf');
const bufCommand = isWin ? process.execPath : bufScript;
const bufArgs = isWin ? [bufScript, 'generate', '--template'] : ['generate', '--template'];

// Use a temp file so we never modify repo files (avoids triggering Nx file watcher)
const tempConfig = path.join(os.tmpdir(), `buf.gen.${process.pid}.yaml`);
const bufGenContent = `version: v2
plugins:
  - local: ${pluginPath.replaceAll('\\', '/')}
    out: src/generated
    include_imports: true
    opt:
      - target=ts
      - import_extension=none
`;

try {
  fs.writeFileSync(tempConfig, bufGenContent, 'utf8');
  execFileSync(bufCommand, [...bufArgs, tempConfig], {
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
