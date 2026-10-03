#!/usr/bin/env node
/**
 * Bulk create/update Gitea issues from UTF-8 JSON.
 *
 * issues.json:
 * [{ "id": "TASK-01", "title": "...", "body": "...", "issueNumber": 1 }]
 *
 * Env: GITEA_OWNER, GITEA_REPO, GITEA_ASSIGNEE, GITEA_BASE_URL, GITEA_MCP_SERVER
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const dataFile = args[0] ?? path.join(process.cwd(), 'issues.json');
const mcpServerName = process.env.GITEA_MCP_SERVER ?? 'gitea-eaafit';

const mcpPath = path.join(os.homedir(), '.cursor', 'mcp.json');
const mcp = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
const cfg = mcp.mcpServers[mcpServerName];
if (!cfg) {
  console.error(`MCP server "${mcpServerName}" not found in mcp.json`);
  process.exit(1);
}

const token = cfg.env?.GITEA_ACCESS_TOKEN;
const owner = process.env.GITEA_OWNER ?? 'eaafit';
const repo = process.env.GITEA_REPO ?? 'WebDevelopment';
const baseUrl =
  process.env.GITEA_BASE_URL ??
  cfg.args?.find((a) => a.startsWith('http')) ??
  'http://192.168.1.98:3000';
const defaultAssignee = process.env.GITEA_ASSIGNEE;

const items = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const apiBase = `${baseUrl.replace(/\/$/, '')}/api/v1/repos/${owner}/${repo}/issues`;

let ok = 0;
let fail = 0;

for (const item of items) {
  const title =
    item.title?.length > 250 ? `${item.title.slice(0, 247)}...` : item.title;
  const payload = {
    title,
    body: item.body ?? '',
    ...(item.assignees || defaultAssignee
      ? { assignees: item.assignees ?? [defaultAssignee] }
      : {}),
    ...(item.labels ? { labels: item.labels } : {}),
  };

  const url = item.issueNumber ? `${apiBase}/${item.issueNumber}` : apiBase;
  const method = item.issueNumber ? 'PATCH' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `token ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const data = await res.json();
    console.log(`${method} #${data.number} ${item.id ?? ''} ${title.slice(0, 50)}`);
    ok++;
  } catch (e) {
    console.error(`FAIL ${item.id ?? '?'}: ${e.message}`);
    fail++;
  }
}

console.log(`Done: ${ok} ok, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
