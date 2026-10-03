# Gitea MCP — справочник (Notarius / WebDevelopment)

## Конфигурация Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "gitea-eaafit": {
      "command": "E:\\Distributive\\gitea-mcp.exe",
      "args": ["-t", "stdio", "--host", "http://192.168.1.98:3000"],
      "env": {
        "GITEA_ACCESS_TOKEN": "<PAT>",
        "GITEA_INSECURE": "true"
      }
    }
  }
}
```

Имя в Cursor UI: `gitea-eaafit` → MCP tools: `user-gitea-eaafit`.

## Scopes PAT

| Scope | Нужен для |
|-------|-----------|
| `read:user` | `list_my_repos`, профиль |
| `read:repository` | репо, ветки, файлы |
| `write:issue` | create/update issues |

## MCP tools

| Tool | Назначение |
|------|------------|
| `issue_write` | create, update, comments, labels |
| `issue_read` | get (`issue_number`), get_comments |
| `list_issues` | список issues |
| `search_users` | login исполнителя |

`get_file_contents`: параметр **`path`**, не `filepath`.

## REST API

```
POST   /api/v1/repos/eaafit/WebDevelopment/issues
PATCH  /api/v1/repos/eaafit/WebDevelopment/issues/{number}
```

`Content-Type: application/json; charset=utf-8`, body через `JSON.stringify` (Node).

## Синхронизация E2E-плана

- План: `docs/e2e-playwright-plan.md` (54 теста E2E-000 … E2E-052)
- Issue **#N** ↔ **N-й** тест в плане
- Скрипт: `node scripts/sync-gitea-e2e-issues.mjs`
- При повторном запуске: только PATCH, не создавать дубликаты

## Кодировка

Кириллица: Node.js или MCP. PowerShell для bulk — нет.

## Ссылки

- https://gitea.com/gitea/gitea-mcp/releases
- E2E skill: `.cursor/skills/angular-e2e-playwright.md`
