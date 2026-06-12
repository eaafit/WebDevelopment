#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { dirname, join, relative } from 'node:path';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';

const rootDir = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const packageJsonPath = join(rootDir, 'package.json');
const nodeModulesDir = join(rootDir, 'node_modules');
const includeDev = process.argv.includes('--include-dev');
const outputPath =
  process.argv.find((arg) => arg.endsWith('.json')) ??
  join(rootDir, 'docs', 'security', 'sbom', 'notary-portal-pnpm.cdx.json');

const rootPackage = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const directRuntimeDeps = new Set(Object.keys(rootPackage.dependencies ?? {}));
const directDevDeps = new Set(Object.keys(rootPackage.devDependencies ?? {}));
const directOptionalDeps = new Set(Object.keys(rootPackage.optionalDependencies ?? {}));

const normalizePackageName = (name) => {
  if (!name || typeof name !== 'string') {
    return '';
  }

  return name.trim();
};

const purlName = (name) => {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.split('/');
    return `${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}`;
  }

  return encodeURIComponent(name);
};

const bomRefFor = (name, version) => `pkg:npm/${purlName(name)}@${encodeURIComponent(version)}`;

const packageScope = (name) => {
  if (directRuntimeDeps.has(name)) {
    return 'required';
  }

  if (directOptionalDeps.has(name)) {
    return 'optional';
  }

  if (directDevDeps.has(name)) {
    return 'excluded';
  }

  return 'required';
};

const readPackageJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const byRef = new Map();
const visitedPaths = new Set();

const packagePathParts = (name) => name.split('/');

const resolvePackageJson = (name, startDir) => {
  let current = startDir;

  while (current.startsWith(rootDir)) {
    const candidate = join(current, 'node_modules', ...packagePathParts(name), 'package.json');

    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  const rootCandidate = join(nodeModulesDir, ...packagePathParts(name), 'package.json');
  return existsSync(rootCandidate) ? rootCandidate : null;
};

const dependencyNames = (pkg) => [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.optionalDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

const collectPackage = (name, startDir = rootDir) => {
  const packagePath = resolvePackageJson(name, startDir);

  if (!packagePath) {
    return;
  }

  const realPackagePath = realpathSync(packagePath);

  if (visitedPaths.has(realPackagePath)) {
    return;
  }

  visitedPaths.add(realPackagePath);
  const pkg = readPackageJson(packagePath);
  const packageName = normalizePackageName(pkg?.name);
  const version = String(pkg?.version ?? '').trim();

  if (!packageName || !version) {
    return;
  }

  const bomRef = bomRefFor(packageName, version);
  const packageDir = dirname(packagePath);
  const location = relative(rootDir, packageDir);
  const manifestHash = createHash('sha256').update(readFileSync(packagePath)).digest('hex');
  const licenses = [];

  if (typeof pkg.license === 'string' && pkg.license.trim()) {
    licenses.push({ license: { name: pkg.license.trim() } });
  }

  if (Array.isArray(pkg.licenses)) {
    for (const license of pkg.licenses) {
      if (typeof license === 'string') {
        licenses.push({ license: { name: license } });
      } else if (typeof license?.type === 'string') {
        licenses.push({ license: { name: license.type } });
      }
    }
  }

  if (!byRef.has(bomRef)) {
    byRef.set(bomRef, {
      type: 'library',
      'bom-ref': bomRef,
      name: packageName,
      version,
      scope: packageScope(packageName),
      purl: bomRef,
      licenses,
      hashes: [
        {
          alg: 'SHA-256',
          content: manifestHash,
        },
      ],
      externalReferences: pkg.homepage
        ? [
            {
              type: 'website',
              url: pkg.homepage,
            },
          ]
        : undefined,
      properties: [
        {
          name: 'notary-portal:package-manager',
          value: 'pnpm',
        },
        {
          name: 'notary-portal:package-path',
          value: location,
        },
        {
          name: 'notary-portal:direct-dependency',
          value: String(
            directRuntimeDeps.has(packageName) ||
              directDevDeps.has(packageName) ||
              directOptionalDeps.has(packageName),
          ),
        },
      ],
    });
  }

  for (const dependencyName of dependencyNames(pkg)) {
    collectPackage(dependencyName, packageDir);
  }
};

const rootDependencyNames = [
  ...Object.keys(rootPackage.dependencies ?? {}),
  ...Object.keys(rootPackage.optionalDependencies ?? {}),
  ...(includeDev ? Object.keys(rootPackage.devDependencies ?? {}) : []),
].sort();

for (const name of rootDependencyNames) {
  collectPackage(name);
}

const components = [...byRef.values()]
  .map((component) => {
    if (!component.licenses.length) {
      delete component.licenses;
    }

    if (!component.externalReferences?.length) {
      delete component.externalReferences;
    }

    return component;
  })
  .sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName === 0 ? left.version.localeCompare(right.version) : byName;
  });

const rootRef = `pkg:npm/${purlName(rootPackage.name)}@${encodeURIComponent(rootPackage.version ?? '0.0.0')}`;
const directRefs = [...new Set([...directRuntimeDeps, ...directOptionalDeps, ...directDevDeps])]
  .map((name) => components.find((component) => component.name === name)?.['bom-ref'])
  .filter(Boolean)
  .sort();

const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${createHash('sha256')
    .update(`${rootPackage.name}:${rootPackage.version}:${components.length}`)
    .digest('hex')
    .slice(
      0,
      8,
    )}-${createHash('sha256').update(rootPackage.name).digest('hex').slice(0, 4)}-${createHash(
    'sha256',
  )
    .update(rootPackage.version ?? '0.0.0')
    .digest('hex')
    .slice(
      0,
      4,
    )}-${createHash('sha256').update(String(components.length)).digest('hex').slice(0, 4)}-${createHash(
    'sha256',
  )
    .update(components.map((component) => component['bom-ref']).join('\n'))
    .digest('hex')
    .slice(0, 12)}`,
  version: 1,
  metadata: {
    timestamp: '2026-06-06T00:00:00.000Z',
    tools: [
      {
        vendor: 'notary-portal',
        name: 'scripts/ci/generate-sbom.mjs',
        version: '1.0.0',
      },
    ],
    component: {
      type: 'application',
      'bom-ref': rootRef,
      name: rootPackage.name,
      version: rootPackage.version ?? '0.0.0',
      purl: rootRef,
    },
    properties: [
      {
        name: 'notary-portal:lockfile',
        value: 'pnpm-lock.yaml',
      },
      {
        name: 'notary-portal:scope',
        value: includeDev ? 'runtime-and-development' : 'runtime',
      },
      {
        name: 'notary-portal:component-count',
        value: String(components.length),
      },
    ],
  },
  components,
  dependencies: [
    {
      ref: rootRef,
      dependsOn: directRefs,
    },
    ...components.map((component) => ({
      ref: component['bom-ref'],
      dependsOn: [],
    })),
  ],
};

writeFileSync(outputPath, `${JSON.stringify(bom, null, 2)}\n`);
console.log(`Wrote ${components.length} components to ${relative(rootDir, outputPath)}`);
