# Runtime SBOM Evidence

This directory stores a reproducible CycloneDX inventory for the Notary Portal runtime dependency set.

The committed file is intentionally limited to runtime dependencies reachable from `package.json` `dependencies` and `optionalDependencies`. It does not include the full Nx, Angular CLI, Jest, ESLint and Stylelint development toolchain unless the generator is called with `--include-dev`.

## Files

| File                              | Purpose                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `notary-portal-pnpm.cdx.json`     | CycloneDX 1.5 runtime dependency inventory generated from the installed pnpm layout. |
| `scripts/ci/generate-sbom.mjs`    | Local generator used to refresh the SBOM from `node_modules` and `package.json`.     |
| `.gitlab-ci.yml` `cyclonedx_scan` | Container image SBOM job that produces image-level SBOM artifacts for release tags.  |

## Why This SBOM Is Committed

The GitLab pipeline produces image-level SBOM artifacts for release tags, but a committed runtime SBOM is useful for a coursework review because it makes the supply-chain layer visible in the pull request itself:

1. reviewers can inspect the real dependency inventory without opening CI artifacts;
2. the repository has a stable example of CycloneDX output;
3. local verification can compare generated output with the committed file;
4. the PR demonstrates both dependency-level and container-level evidence.

## Regenerate

```bash
node scripts/ci/generate-sbom.mjs docs/security/sbom/notary-portal-pnpm.cdx.json
jq empty docs/security/sbom/notary-portal-pnpm.cdx.json
```

The generator expects dependencies to be installed:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
pnpm install --frozen-lockfile
```

To include development dependencies as well:

```bash
node scripts/ci/generate-sbom.mjs docs/security/sbom/notary-portal-pnpm-dev.cdx.json --include-dev
```

The development SBOM is much larger and is not committed by default because the release images only need the runtime dependency evidence.

## Local Review Checklist

1. Confirm the SBOM is valid JSON.
2. Confirm `bomFormat` is `CycloneDX`.
3. Confirm `specVersion` is `1.5`.
4. Confirm `metadata.component.name` matches `@notary-portal/source`.
5. Confirm `metadata.properties` contains `notary-portal:scope = runtime`.
6. Confirm `metadata.properties` contains a non-zero `notary-portal:component-count`.
7. Confirm direct runtime packages such as `@nestjs/core`, `@angular/core`, `express`, `pg`, `pino` and `prom-client` are present.
8. Confirm obvious dev-only packages such as `jest`, `eslint` and `typescript` are absent from the runtime file.
9. Confirm the root dependency graph references direct runtime dependencies.
10. Confirm CI still generates image SBOM artifacts for tag builds.

Useful commands:

```bash
jq -r '.bomFormat, .specVersion, .metadata.component.name' docs/security/sbom/notary-portal-pnpm.cdx.json
jq '.components | length' docs/security/sbom/notary-portal-pnpm.cdx.json
jq -r '.components[].name' docs/security/sbom/notary-portal-pnpm.cdx.json | sort | grep -E '(^@nestjs/core$|^@angular/core$|^express$|^pg$|^prom-client$)'
jq -r '.components[].name' docs/security/sbom/notary-portal-pnpm.cdx.json | sort | grep -E '(^jest$|^eslint$|^typescript$)' || true
```

## Relationship To Trivy

The committed SBOM and the Trivy CI jobs answer different questions.

| Evidence                   | Question Answered                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Runtime SBOM               | Which npm packages are reachable from the app runtime dependency graph?                 |
| Trivy image scan           | Which vulnerabilities are visible in the built container images?                        |
| Trivy CycloneDX image SBOM | Which OS and application components are present inside each pushed image?               |
| SonarQube                  | Which code quality, maintainability and security issues are visible in the source tree? |

The runtime SBOM is therefore not a replacement for container scanning. It is a stable local artifact that complements the release pipeline.

## CI Expectations

The `cyclonedx_scan` GitLab job runs only for valid release tags. Its output is stored as CI artifacts:

- `sbom-api.cdx.json`
- `sbom-web.cdx.json`

Those files are image SBOMs. They include operating system packages from base images such as `node:24-bookworm-slim` and `nginx:1.27-alpine`, plus application-level components detected by the scanner.

## Updating Policy

Refresh `notary-portal-pnpm.cdx.json` when:

- `pnpm-lock.yaml` changes;
- runtime dependencies in `package.json` change;
- the Node/pnpm install layout changes;
- a security review asks for a fresh dependency inventory;
- a release candidate tag is prepared and the PR needs pinned evidence.

Do not refresh it for unrelated documentation-only changes, because that creates noisy diffs.

## Known Limits

The generator follows installed package links instead of parsing the full `pnpm-lock.yaml` graph. This keeps the output aligned with what the local build actually installs, but it also means the SBOM should be regenerated after `pnpm install --frozen-lockfile`.

Peer dependencies are included when they can be resolved from the package directory. Optional dependencies are included when they are present in the installed layout.

The file is generated with a stable timestamp so repeated runs are reviewable. The component hashes are based on package manifests, not tarball archives.
