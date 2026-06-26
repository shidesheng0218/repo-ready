import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildUnifiedDiff, generateFixesWithTemplate, listAgentTemplates, renderReport, scanRepository } from "../packages/core/src/index.js";

test("scan empty repository and generate fixes", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-empty-"));
  const report = await scanRepository({ cwd: dir });
  assert.equal(report.scores.agentReady < 70, true);
  assert.equal(report.fixes.changes.some((c) => c.path === "AGENTS.md"), true);
  assert.match(renderReport(report, { lang: "zh" }), /报告|总分/);
  assert.match(buildUnifiedDiff(report.fixes.changes), /AGENTS\.md/);
});

test("detect package scripts and dangerous commands", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-node-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ scripts: { test: "node --test", build: "tsc", clean: "rm -rf /" } }), "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Installation\n\n## Usage\n\n## Testing\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  assert.equal(report.commands.test, "node --test");
  assert.equal(report.dangerousScripts.length, 1);
  assert.equal(report.scores.safety < 100, true);
});

test("weighted scoring handles detected command strings without NaN", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-score-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({ scripts: { test: "node --test", build: "tsc" } }), "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Usage\n\n## Testing\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  assert.equal(Number.isNaN(report.scores.overall), false);
  assert.equal(Number.isNaN(report.scores.agentReady), false);
  assert.equal(report.scores.agentReady > 0, true);
  assert.equal(report.scoreComparison.hasBaseline, false);
});

test("baseline comparison reports before and after score deltas", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-baseline-"));
  await fs.writeFile(path.join(dir, ".repoready-baseline.json"), JSON.stringify({
    overall: 50,
    agentReady: 40,
    contributorReady: 50,
    contextQuality: 60,
    safety: 70
  }), "utf8");
  await fs.writeFile(path.join(dir, "AGENTS.md"), "# Agent guide\n", "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Installation\n\n## Usage\n\n## Testing\n\n## Contributing\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  assert.equal(report.scoreComparison.hasBaseline, true);
  assert.equal(typeof report.scoreComparison.deltas.overall, "number");
  assert.match(renderReport(report, { format: "markdown" }), /Baseline Comparison/);
});

test("infer commands and detect repository health signals", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-health-"));
  await fs.writeFile(path.join(dir, "go.mod"), "module example.com/demo\n", "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n![badge](https://img.shields.io/badge/demo-blue)\n\n## Installation\n\n## Usage\n\n## Demo\n\n## Testing\n\n## Contributing\n\n## Roadmap\n", "utf8");
  await fs.mkdir(path.join(dir, ".github", "workflows"), { recursive: true });
  await fs.writeFile(path.join(dir, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8");
  await fs.writeFile(path.join(dir, ".gitignore"), "node_modules\n.env\n", "utf8");
  await fs.writeFile(path.join(dir, ".env.example"), "EXAMPLE=1\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  assert.equal(report.stack.languages.includes("Go"), true);
  assert.equal(report.commands.test, "go test ./...");
  assert.equal(report.repoHealth.hasCi, true);
  assert.equal(report.repoHealth.hasEnvExample, true);
  assert.equal(report.scores.agentReady >= 35, true);
});

test("list available agent templates", () => {
  const templates = listAgentTemplates();
  assert.equal(templates.length >= 5, true);
  assert.equal(templates.some((t) => t.key === "next.js"), true);
});

test("generate fixes with go template", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-template-"));
  await fs.writeFile(path.join(dir, "go.mod"), "module example.com/demo\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  const enhanced = generateFixesWithTemplate(report, "go");
  assert.equal(enhanced.changes.some((c) => c.path === "AGENTS.md"), true);
  const agentsMd = enhanced.changes.find((c) => c.path === "AGENTS.md");
  assert.match(agentsMd.content, /go test \.\/\.\.\./);
});
