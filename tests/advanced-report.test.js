import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderReport, scanRepository } from "../packages/core/src/index.js";

test("report includes evidence, score breakdown, and code quality", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-evidence-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      build: "tsc",
      lint: "eslint .",
      typecheck: "tsc --noEmit",
      format: "prettier --check ."
    },
    devDependencies: {
      eslint: "latest",
      prettier: "latest"
    }
  }), "utf8");
  await fs.writeFile(path.join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true } }), "utf8");
  await fs.writeFile(path.join(dir, "AGENTS.md"), "# Agent guide\n", "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Installation\n\n## Usage\n\n## Testing\n\n## Contributing\n", "utf8");
  await fs.mkdir(path.join(dir, ".github", "workflows"), { recursive: true });
  await fs.writeFile(path.join(dir, ".github", "workflows", "ci.yml"), "name: CI\n", "utf8");
  await fs.mkdir(path.join(dir, "tests"), { recursive: true });
  await fs.writeFile(path.join(dir, "tests", "demo.test.js"), "import test from 'node:test';\n", "utf8");

  const report = await scanRepository({ cwd: dir });

  assert.equal(typeof report.scores.codeQuality, "number");
  assert.equal(report.scores.codeQuality >= 80, true);
  assert.equal(report.evidence.some((e) => e.id === "agent-instructions" && e.status === "pass"), true);
  assert.equal(report.evidence.some((e) => e.id === "test-command" && e.detail.includes("node --test")), true);
  assert.equal(report.scoreBreakdown.agentReady.some((i) => i.id === "agent-instructions"), true);

  const markdown = renderReport(report, { format: "markdown", lang: "en" });
  assert.match(markdown, /Code Quality/);
  assert.match(markdown, /Evidence/);
  assert.match(markdown, /Score Breakdown/);
});

test("filterFixes keeps only requested fix groups", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-filter-"));
  const report = await scanRepository({ cwd: dir });
  const { filterFixes } = await import("../packages/core/src/index.js");

  const agentsOnly = filterFixes(report.fixes, ["agents"]);
  assert.deepEqual(agentsOnly.changes.map((c) => c.path), ["AGENTS.md"]);

  const docsAndCi = filterFixes(report.fixes, ["readme", "ci"]);
  assert.equal(docsAndCi.changes.some((c) => c.path === "README.md"), true);
  assert.equal(docsAndCi.changes.some((c) => c.path.includes("workflows")), true);
  assert.equal(docsAndCi.changes.some((c) => c.path === "AGENTS.md"), false);
});
