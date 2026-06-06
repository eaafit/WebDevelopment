---
name: gitea-mcp-issues
description: >-
  Creates and updates Gitea issues via MCP (gitea-mcp) or Gitea REST API with
  correct UTF-8 for Cyrillic. Use when the user asks to create Gitea tasks/issues,
  bulk issues from markdown plans, assign issues to users, or sync issues in
  eaafit/WebDevelopment or any configured gitea-* MCP server.
---

# Gitea MCP — создание и обновление issues

## Когда применять

- «создай задачи в Gitea», «issue на пользователя X», массовое создание из документа
- синхронизация `docs/e2e-playwright-plan.md` → issues в Gitea
- исправление кодировки или обновление тел существующих issues

## Предусловия

1. **MCP-сервер** в `~/.cursor/mcp.json` (в проекте: `gitea-eaafit`):
   - `command`: путь к `gitea-mcp.exe`
   - `args`: `["-t", "stdio", "--host", "http://192.168.1.98:3000"]`
   - `env`: `GITEA_ACCESS_TOKEN`, `GITEA_INSECURE: "true"` (HTTP)

2. **PAT:** `read:user`, `read:repository`, `write:issue`

3. **Проверка MCP:** `get_gitea_mcp_server_version` или `list_issues` без ошибки

4. **Исполнитель:** `search_users` → в `assignees` передавать **login** (например `lirimmid`)

Подробности: [reference.md](reference.md).

## Параметры этого репозитория

| Параметр | Значение |
|----------|----------|
| MCP server (CallMcpTool) | `user-gitea-eaafit` |
| owner / repo | `eaafit` / `WebDevelopment` |
| Issues UI | http://192.168.1.98:3000/eaafit/WebDevelopment/issues |
| E2E-план → issues | `scripts/sync-gitea-e2e-issues.mjs` |

## Рабочий процесс

### 1. Прочитать схему tool

`mcps/user-gitea-eaafit/tools/issue_write.json` (и `issue_read.json` при чтении).

### 2. Одна issue — MCP

```json
{
  "server": "user-gitea-eaafit",
  "toolName": "issue_write",
  "arguments": {
    "method": "create",
    "owner": "eaafit",
    "repo": "WebDevelopment",
    "title": "[E2E-001] Краткое название",
    "body": "## Описание\n\n...",
    "assignees": ["lirimmid"]
  }
}
```

**Обновление:** `method: "update"`, `issue_number`. **Закрыть:** `state: "closed"`.

### 3. Массово — только Node.js

Не использовать PowerShell `ConvertTo-Json` для кириллицы (mojibake).

```bash
node scripts/sync-gitea-e2e-issues.mjs
node scripts/bulk-gitea-issues.mjs path/to/issues.json
```

Перед POST: проверить `list_issues`; существующие номера — **PATCH**, не дублировать POST.

### 4. Шаблон тела (E2E / US)

```markdown
## Автоматизированный E2E-тест (Playwright)

**Спека:** `apps/web-e2e/src/specs/...`
**Теги:** `@auth @P0`
**Документ:** `docs/e2e-playwright-plan.md`

### Критерии готовности
- [ ] Spec в `apps/web-e2e`
- [ ] `pnpm nx e2e web-e2e --grep @tag` проходит
```

См. skill [angular-e2e-playwright.md](../angular-e2e-playwright.md) для реализации тестов.

### 5. Проверка

`issue_read` → кириллица OK, `assignees` верный.

## Скрипты проекта

| Скрипт | Назначение |
|--------|------------|
| `scripts/sync-gitea-e2e-issues.mjs` | 54 E2E из `docs/e2e-playwright-plan.md` → issues #1–#54 |
| `scripts/bulk-gitea-issues.mjs` | Универсальный bulk из UTF-8 JSON |
| `scripts/create-gitea-us-issues.ps1` | Обёртка: `node scripts/sync-gitea-e2e-issues.mjs` |

Токен: `~/.cursor/mcp.json` → `mcpServers.gitea-eaafit.env.GITEA_ACCESS_TOKEN`.

## Безопасность

Не коммитить PAT. Не выводить токен в чат/issues.
