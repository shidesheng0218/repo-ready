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

test("doctor, tasks, and context pack produce agent-ready outputs", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-agent-kit-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      build: "tsc",
      lint: "eslint ."
    }
  }), "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Installation\n\n## Usage\n\n## Testing\n\n## Contributing\n", "utf8");
  await fs.writeFile(path.join(dir, "AGENTS.md"), "# Agent guide\n", "utf8");

  const report = await scanRepository({ cwd: dir });
  const { buildAgentTasks, generateContextPack, renderDoctorReport } = await import("../packages/core/src/index.js");

  const doctor = renderDoctorReport(report, { lang: "en" });
  assert.match(doctor, /Diagnosis/);
  assert.match(doctor, /Strengths/);
  assert.match(doctor, /Recommended next step/);

  const tasks = buildAgentTasks(report, { lang: "en" });
  assert.equal(tasks.length > 0, true);
  assert.equal(tasks.every((task) => task.prompt && task.risk && task.files), true);
  assert.match(tasks[0].prompt, /Please|Add|Review|Improve/);

  const context = generateContextPack(report, { lang: "en" });
  assert.equal(context.changes.some((c) => c.path === ".repo-ready/context/project-map.md"), true);
  assert.equal(context.changes.some((c) => c.path === ".repo-ready/context/ai-agent-brief.md"), true);
  assert.match(context.changes.find((c) => c.path.endsWith("commands.md")).content, /node --test/);
});

test("spec, fix plan, and policy compliance support standardization workflows", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-standard-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      build: "tsc"
    }
  }), "utf8");
  await fs.writeFile(path.join(dir, "README.md"), "# Demo\n\n## Usage\n", "utf8");
  const report = await scanRepository({ cwd: dir });
  const {
    buildFixPlan,
    buildPolicyTemplate,
    evaluatePolicy,
    renderAgentReadySpec,
    renderFixPlan,
    renderPolicyReport
  } = await import("../packages/core/src/index.js");

  const spec = renderAgentReadySpec({ lang: "en" });
  assert.match(spec, /Agent Ready Repository Standard/);
  assert.match(spec, /AGENTS.md/);
  assert.match(spec, /Safety boundaries/);

  const fixPlan = buildFixPlan(report);
  assert.equal(fixPlan.safe.some((item) => item.path === "AGENTS.md"), true);
  assert.equal(fixPlan.review.some((item) => item.path === "README.md"), true);
  assert.match(renderFixPlan(fixPlan, { lang: "en" }), /Safe automatic fixes/);

  const policyText = buildPolicyTemplate({ lang: "en" });
  assert.match(policyText, /require_test_command/);
  assert.match(policyText, /block_dangerous_scripts/);

  const policy = evaluatePolicy(report);
  assert.equal(typeof policy.score, "number");
  assert.equal(policy.checks.some((check) => check.id === "agent-instructions"), true);
  assert.match(renderPolicyReport(policy, { lang: "en" }), /Policy Compliance/);
});

test("spec, policy, and fix plan expose strategic readiness controls", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repoready-policy-"));
  await fs.writeFile(path.join(dir, "package.json"), JSON.stringify({
    scripts: {
      test: "node --test",
      clean: "rm -rf /"
    }
  }), "utf8");
  const report = await scanRepository({ cwd: dir });
  const {
    buildDefaultPolicy,
    buildFixPlan,
    checkPolicyCompliance,
    renderAgentReadySpec,
    renderFixPlan,
    renderPolicyCompliance
  } = await import("../packages/core/src/index.js");

  const spec = renderAgentReadySpec({ lang: "en" });
  assert.match(spec, /Agent Ready Repository Standard/);
  assert.match(spec, /AGENTS.md/);
  assert.match(spec, /Safety boundaries/);

  const policy = buildDefaultPolicy();
  assert.equal(policy.agent.require_test_command, true);
  assert.equal(policy.safety.block_dangerous_scripts, true);

  const compliance = checkPolicyCompliance(report, policy);
  assert.equal(typeof compliance.score, "number");
  assert.equal(compliance.violations.some((v) => v.id === "dangerous-scripts"), true);
  assert.match(renderPolicyCompliance(compliance, { lang: "en" }), /Policy Compliance/);

  const fixPlan = buildFixPlan(report);
  assert.equal(fixPlan.safe.some((c) => c.path === "AGENTS.md"), true);
  assert.equal(fixPlan.manual.some((item) => item.id === "dangerous-scripts"), true);
  assert.match(renderFixPlan(fixPlan, { lang: "en" }), /Safe automatic fixes/);
});
