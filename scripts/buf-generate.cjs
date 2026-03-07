'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execSync } = require('node:child_process');

// Run from cwd = libs/shared/api-contracts; workspace root is ../../..
const cwd = process.cwd();
const root = path.resolve(cwd, '..', '..', '..');
const pluginPath = path.join(root, 'node_modules', '.bin', 'protoc-gen-es');

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
  execSync(`buf generate --template "${tempConfig}"`, { cwd, stdio: 'inherit', env: process.env });
} finally {
  try {
    fs.unlinkSync(tempConfig);
  } catch (error) {
    console.error('Failed to remove temp buf config:', tempConfig, error);
  }
}
