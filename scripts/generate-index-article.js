import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const input = process.env.REPOREADY_INDEX_OUT || path.join(root, "data", "index", "latest.json");
const date = new Date().toISOString().slice(0, 7);
const output = path.join(root, "docs", `agent-ready-index-${date}.md`);

const rawIndex = await fs.readFile(input, "utf8");
const index = JSON.parse(rawIndex.replace(/^\uFEFF/, ""));
const entries = (index.entries || []).filter(Boolean);
const pct = (count) => entries.length ? `${Math.round((count / entries.length) * 100)}%` : "0%";
const avgOf = (key) => Math.round(entries.reduce((sum, item) => sum + Number(item[key] || 0), 0) / Math.max(entries.length, 1));
const missingAgents = entries.filter((item) => !item.hasAgentInstructions).length;
const missingTests = entries.filter((item) => !item.hasTestCommand).length;
const risky = entries.filter((item) => Number(item.dangerousScripts || 0) > 0).length;
const contextRisk = entries.filter((item) => Number(item.contextQuality || 0) < 70).length;
const onboardingRisk = entries.filter((item) => Number(item.contributorReady || 0) < 70).length;
const validationRisk = missingTests;
const scopeRisk = missingAgents;
const top = [...entries].sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0)).slice(0, 10);
const blockers = [
  { name: "Missing agent instructions", count: missingAgents, why: "Agents must infer repository structure and boundaries." },
  { name: "Missing test command", count: missingTests, why: "Agents cannot prove changes work." },
  { name: "Dangerous scripts", count: risky, why: "Agents need explicit human-approval boundaries." },
  { name: "Context quality below 70", count: contextRisk, why: "Generated files or noisy context can confuse agents." },
  { name: "Contributor readiness below 70", count: onboardingRisk, why: "Humans and agents both need clear onboarding." }
].sort((a, b) => b.count - a.count);

const topRows = top.map((item, i) => `| ${i + 1} | [${item.repo}](${item.url}) | ${item.overall} | ${item.agentReady} | ${item.contributorReady ?? "-"} | ${item.safety} |`).join("\n") || "| - | - | - | - | - | - |";
const blockerRows = blockers.map((item) => `| ${item.name} | ${item.count} | ${pct(item.count)} | ${item.why} |`).join("\n");
const riskRows = [
  ["Scope drift", scopeRisk, "Missing AGENTS.md / CLAUDE.md / Cursor rules"],
  ["Validation gap", validationRisk, "Missing test command"],
  ["Safety boundary", risky, "Dangerous scripts detected"],
  ["Context confusion", contextRisk, "Low context quality score"],
  ["Onboarding gap", onboardingRisk, "Low contributor readiness score"]
].map(([name, count, signal]) => `| ${name} | ${count} | ${pct(count)} | ${signal} |`).join("\n");

const md = `# Agent Ready Index ${date}

## Executive summary

RepoReady scanned **${entries.length} public GitHub repositories** for AI coding agent readiness: whether a repository is clear, safe, validated, and easy for Codex, Claude Code, Cursor, and contributors to work with.

Average scores:

- Overall RepoReady score: **${avgOf("overall")}/100**
- Agent Ready: **${avgOf("agentReady")}/100**
- Contributor Ready: **${avgOf("contributorReady")}/100**
- Context Quality: **${avgOf("contextQuality")}/100**
- Safety: **${avgOf("safety")}/100**

## Key findings

- **${missingAgents} repositories (${pct(missingAgents)})** are missing agent instructions such as AGENTS.md, CLAUDE.md, or Cursor rules.
- **${missingTests} repositories (${pct(missingTests)})** are missing a detected test command.
- **${risky} repositories (${pct(risky)})** contain potentially dangerous scripts.
- The most common blocker is **${blockers[0]?.name || "none"}**.

## Top 10 Agent-Ready repositories

| Rank | Repository | Overall | Agent Ready | Contributor | Safety |
| ---: | --- | ---: | ---: | ---: | ---: |
${topRows}

## Most common blockers

| Blocker | Count | Ratio | Why it matters |
| --- | ---: | ---: | --- |
${blockerRows}

## Failure risk distribution

| Failure risk | Count | Ratio | Signal |
| --- | ---: | ---: | --- |
${riskRows}

## Metric ratios

- Missing AGENTS.md / agent instruction ratio: **${pct(missingAgents)}**
- Missing test command ratio: **${pct(missingTests)}**
- Dangerous scripts count: **${risky}**

## Methodology

RepoReady uses static analysis only. It checks agent instruction files, validation commands, README onboarding, context quality, safety boundaries, GitHub Actions, and code-quality signals. It does **not** execute repository scripts and does **not** upload private local source by default.

## ????

RepoReady ??? **${entries.length} ??? GitHub ??**????????? Codex?Claude Code?Cursor ? AI ?????????????? AGENTS.md ??? agent ?????????????????????????RepoReady ????????????????????????????? AI ?????????

## Launch copy

### Hacker News

Show HN: RepoReady Agent Ready Index ? we scanned ${entries.length} repos for AI coding agent readiness

### Reddit

I built RepoReady and used it to scan ${entries.length} public GitHub repositories for AI coding agent readiness: AGENTS.md, validation commands, README onboarding, context noise, and safety boundaries.

### X

We scanned ${entries.length} GitHub repositories for AI coding agent readiness. Missing AGENTS.md: ${pct(missingAgents)}. Missing test command: ${pct(missingTests)}. Dangerous scripts: ${risky}.\n\nRepoReady Agent Ready Index ${date}

### V2EX

????? RepoReady ????? GitHub ??????????? AI ??????

### ?? / ??

???AI ???????????????? RepoReady ???? Agent Ready Index
`;

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, md, "utf8");
console.log(`wrote ${output}`);
