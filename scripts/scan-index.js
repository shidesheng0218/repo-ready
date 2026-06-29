import fs from "node:fs/promises";
import path from "node:path";
import { scanGitHubRepository } from "../packages/core/src/index.js";

const root = process.cwd();
const seedPath = process.env.REPOREADY_INDEX_SEED || path.join(root, "docs", "index-seed-repos.json");
const outPath = process.env.REPOREADY_INDEX_OUT || path.join(root, "data", "index", "latest.json");
const limit = Number(process.env.REPOREADY_INDEX_LIMIT || 100);
const concurrency = Number(process.env.REPOREADY_INDEX_CONCURRENCY || 3);
const repos = JSON.parse(await fs.readFile(seedPath, "utf8")).slice(0, limit);
const entries = [];
const failures = [];
let cursor = 0;

await Promise.all(Array.from({ length: Math.min(concurrency, repos.length) }, async () => {
  while (cursor < repos.length) {
    const repo = repos[cursor++];
    try {
      const report = await scanGitHubRepository(`https://github.com/${repo}`, { githubToken: process.env.GITHUB_TOKEN });
      entries.push({
        repo,
        url: `https://github.com/${repo}`,
        overall: report.scores.overall,
        agentReady: report.scores.agentReady,
        contributorReady: report.scores.contributorReady,
        contextQuality: report.scores.contextQuality,
        safety: report.scores.safety,
        codeQuality: report.scores.codeQuality,
        issues: report.issues.length,
        fixes: report.fixes.changes.length,
        hasAgentInstructions: Boolean(report.agentFiles?.any),
        hasTestCommand: Boolean(report.commands?.test),
        dangerousScripts: report.dangerousScripts.length,
        scannedAt: new Date().toISOString()
      });
      console.log(`scanned ${repo}`);
    } catch (error) {
      failures.push({ repo, error: error.message });
      console.warn(`failed ${repo}: ${error.message}`);
    }
  }
}));

entries.sort((a, b) => b.overall - a.overall);
await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, JSON.stringify({ entries, failures, updatedAt: new Date().toISOString() }, null, 2), "utf8");
console.log(`wrote ${outPath} with ${entries.length} entries and ${failures.length} failures`);
