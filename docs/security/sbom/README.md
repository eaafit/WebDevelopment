# Доказательство Runtime SBOM

Эта директория хранит воспроизводимый CycloneDX-инвентарь runtime-зависимостей портала нотариальных услуг.

Committed SBOM намеренно ограничен runtime-зависимостями из `package.json` `dependencies` и `optionalDependencies`. Полная dev toolchain Nx, Angular CLI, Jest, ESLint и Stylelint не попадает в этот файл, если генератор не запущен с флагом `--include-dev`.

## Файлы

| Файл                              | Назначение                                                                  |
| --------------------------------- | --------------------------------------------------------------------------- |
| `notary-portal-pnpm.cdx.json`     | CycloneDX 1.5 inventory runtime-зависимостей, созданный из pnpm layout.     |
| `scripts/ci/generate-sbom.mjs`    | Локальный генератор для обновления SBOM из `node_modules` и `package.json`. |
| `.gitlab-ci.yml` `cyclonedx_scan` | CI job, который создает image-level SBOM artifacts для релизных тегов.      |

## Зачем SBOM Хранится В Репозитории

GitLab pipeline создает image-level SBOM artifacts для релизных тегов, но committed runtime SBOM полезен для учебного ревью:

1. преподаватель может посмотреть реальный список зависимостей прямо в PR;
2. в репозитории есть стабильный пример CycloneDX output;
3. локальная проверка может сравнить сгенерированный файл с committed file;
4. PR показывает два уровня evidence: dependency-level и container-level.

## Как Перегенерировать

```bash
node scripts/ci/generate-sbom.mjs docs/security/sbom/notary-portal-pnpm.cdx.json
jq empty docs/security/sbom/notary-portal-pnpm.cdx.json
```

Генератор ожидает, что зависимости установлены:

```bash
corepack enable
corepack prepare pnpm@10.29.3 --activate
pnpm install --frozen-lockfile
```

Если нужно включить development dependencies:

```bash
node scripts/ci/generate-sbom.mjs docs/security/sbom/notary-portal-pnpm-dev.cdx.json --include-dev
```

Development SBOM значительно больше и по умолчанию не коммитится, потому что release images требуют evidence именно по runtime-зависимостям.

## Чек-Лист Локального Ревью

1. Убедиться, что SBOM является валидным JSON.
2. Убедиться, что `bomFormat` равен `CycloneDX`.
3. Убедиться, что `specVersion` равен `1.5`.
4. Убедиться, что `metadata.component.name` равен `@notary-portal/source`.
5. Убедиться, что `metadata.properties` содержит `notary-portal:scope = runtime`.
6. Убедиться, что `metadata.properties` содержит ненулевой `notary-portal:component-count`.
7. Проверить наличие прямых runtime packages: `@nestjs/core`, `@angular/core`, `express`, `pg`, `pino`, `prom-client`.
8. Проверить, что dev-only packages `jest`, `eslint`, `typescript` отсутствуют в runtime file.
9. Проверить, что root dependency graph ссылается на прямые runtime dependencies.
10. Проверить, что CI продолжает генерировать image SBOM artifacts для tag builds.

Полезные команды:

```bash
jq -r '.bomFormat, .specVersion, .metadata.component.name' docs/security/sbom/notary-portal-pnpm.cdx.json
jq '.components | length' docs/security/sbom/notary-portal-pnpm.cdx.json
jq -r '.components[].name' docs/security/sbom/notary-portal-pnpm.cdx.json | sort | grep -E '(^@nestjs/core$|^@angular/core$|^express$|^pg$|^prom-client$)'
jq -r '.components[].name' docs/security/sbom/notary-portal-pnpm.cdx.json | sort | grep -E '(^jest$|^eslint$|^typescript$)' || true
```

## Связь С Trivy

Committed SBOM и Trivy jobs отвечают на разные вопросы.

| Evidence                   | На какой вопрос отвечает                                                   |
| -------------------------- | -------------------------------------------------------------------------- |
| Runtime SBOM               | Какие npm packages достижимы из runtime dependency graph приложения?       |
| Trivy image scan           | Какие уязвимости видны в собранных container images?                       |
| Trivy CycloneDX image SBOM | Какие OS и application components находятся внутри каждого pushed image?   |
| SonarQube                  | Какие code quality, maintainability и security issues видны в source tree? |

Runtime SBOM не заменяет container scanning. Это стабильный локальный artifact, который дополняет release pipeline.

## Ожидания От CI

GitLab job `cyclonedx_scan` запускается только для валидных релизных тегов. Результат сохраняется как CI artifacts:

- `sbom-api.cdx.json`
- `sbom-web.cdx.json`

Эти файлы являются image SBOMs. Они включают OS packages из base images `node:24-bookworm-slim` и `nginx:1.27-alpine`, а также application-level components, которые находит scanner.

## Когда Обновлять

Обновлять `notary-portal-pnpm.cdx.json` нужно, когда:

- изменился `pnpm-lock.yaml`;
- изменились runtime dependencies в `package.json`;
- поменялся Node/pnpm install layout;
- security review просит свежий dependency inventory;
- готовится release candidate tag и PR требует pinned evidence.

Для несвязанных documentation-only изменений файл лучше не обновлять, чтобы не создавать шумный diff.

## Известные Ограничения

Генератор идет по установленным package links, а не парсит весь `pnpm-lock.yaml` graph. Это привязывает результат к реально установленной локальной сборке, но означает, что SBOM нужно перегенерировать после `pnpm install --frozen-lockfile`.

Peer dependencies включаются, если их можно разрешить из директории package. Optional dependencies включаются, если они присутствуют в installed layout.

Файл генерируется со стабильным timestamp, чтобы повторные запуски были удобны для review. Component hashes основаны на package manifests, а не на tarball archives.
