# Project Context for Claude

## My Role

Working on **Admin Panel** feature.
Branch: `feat_derkach_es_admin_menu`

## My Working Files

- `apps/web/src/app/features/admin_panel/index.html`
- `apps/web/src/app/features/admin_panel/admin-menu.html`
- `apps/web/src/app/features/admin_panel/script.js`
- `apps/web/src/styles/admin-dashboard/style.css`

## Commit Rules (Conventional Commits)

Format:

```
<type>: <short description in English>
```

| Prefix      | When to use                        |
| ----------- | ---------------------------------- |
| `feat:`     | New functionality                  |
| `fix:`      | Bug fix                            |
| `refactor:` | Refactor without behavior change   |
| `docs:`     | Documentation changes              |
| `style:`    | Formatting, whitespace, semicolons |
| `chore:`    | Dependency updates, build config   |
| `test:`     | Adding or modifying tests          |

Rules:

- Commit message in **English**, keep it short
- **NEVER** add `Co-Authored-By: Claude` — commit is from the user only
- If changes are in the same files — one commit, don't split
- Always add files explicitly (`git add file1 file2`), **never** use `git add .`
- **NEVER** commit or push unless the user explicitly asks

Example:

```bash
git add apps/web/src/app/features/admin_panel/index.html
git commit -m "fix: associate status label with isActive checkbox control"
git push origin feat_derkach_es_admin_menu
```
