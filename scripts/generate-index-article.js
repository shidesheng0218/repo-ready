import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const input = process.env.REPOREADY_INDEX_OUT || path.join(root, "data", "index", "latest.json");
const date = new Date().toISOString().slice(0, 7);
const output = path.join(root, "docs", `agent-ready-index-${date}.md`);
const index = JSON.parse(await fs.readFile(input, "utf8"));
const entries = index.entries || [];
const avg = Math.round(entries.reduce((sum, item) => sum + item.overall, 0) / Math.max(entries.length, 1));
const missingAgents = entries.filter((item) => !item.hasAgentInstructions).length;
const missingTests = entries.filter((item) => !item.hasTestCommand).length;
const risky = entries.filter((item) => item.dangerousScripts > 0).length;
const top = entries.slice(0, 20).map((item, i) => `| ${i + 1} | [${item.repo}](${item.url}) | ${item.overall} | ${item.agentReady} | ${item.safety} |`).join("\n");
const md = `# Agent Ready Index ${date}\n\nWe scanned ${entries.length} public GitHub repositories for AI coding agent readiness.\n\n## Key findings\n\n- Average RepoReady score: ${avg}/100\n- Repositories missing agent instructions: ${missingAgents}\n- Repositories missing detected test commands: ${missingTests}\n- Repositories with potentially dangerous scripts: ${risky}\n\n## Top repositories\n\n| Rank | Repository | Overall | Agent Ready | Safety |\n| ---: | --- | ---: | ---: | ---: |\n${top}\n\n## Method\n\nRepoReady checks agent instructions, validation commands, README onboarding, context quality, safety boundaries, and code-quality signals. The scan does not execute repository scripts.\n\n中文摘要：RepoReady 扫描这些仓库是否适合 Codex、Claude Code、Cursor 等 AI 编程代理协作，并关注测试命令、AGENTS.md、安全边界和上下文质量。\n`;
await fs.writeFile(output, md, "utf8");
console.log(`wrote ${output}`);
