#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import process from "node:process";
import path from "node:path";
import {
  buildDefaultPolicy,
  buildFixPlan,
  buildUnifiedDiff,
  checkPolicyCompliance,
  filterFixes,
  generateFixesWithTemplate,
  generateContextPack,
  listAgentTemplates,
  renderAgentReadySpec,
  renderAgentTasks,
  renderDoctorReport,
  renderFixPlan,
  renderPolicyCompliance,
  renderPolicyYaml,
  renderReport,
  scanGitHubRepository,
  scanRepository,
  writeFixes
} from "../../core/src/index.js";

const args = process.argv.slice(2);
const isFix = args[0] === "fix";
const isDoctor = args[0] === "doctor";
const isTasks = args[0] === "tasks";
const isContext = args[0] === "context";
const isSpec = args[0] === "spec";
const isPolicy = args[0] === "policy";
const lang = readOption("--lang") || (args.includes("--zh") ? "zh" : "en");
const json = args.includes("--json");
const markdown = args.includes("--markdown");
const branch = args.includes("--branch");
const createPr = args.includes("--pr");
const fixPlan = args.includes("--plan");
const applySafe = args.includes("--apply-safe");
const saveBaseline = args.includes("--save-baseline");
const write = args.includes("--write") || branch || createPr || applySafe;
const dryRun = args.includes("--dry-run") || !write;
const baseBranch = readOption("--base") || "main";
const onlyGroups = parseListOption("--only");
const targetArg = readTargetArg(args);

try {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (args[0] === "init") {
    await initInteractive();
    process.exit(0);
  }

  if (args[0] === "templates") {
    const templates = listAgentTemplates();
    console.log("Available agent templates:");
    for (const template of templates) console.log(`  ${template.key}  →  ${template.name}`);
    process.exit(0);
  }

  if (isSpec) {
    console.log(renderAgentReadySpec({ lang }));
    process.exit(0);
  }

  if (isPolicy) {
    const subcommand = args[1] || "check";
    const defaultPolicy = buildDefaultPolicy();
    if (subcommand === "init") {
      const content = renderPolicyYaml(defaultPolicy);
      if (!write) {
        console.log(content);
        process.exit(0);
      }
      const fs = await import("node:fs/promises");
      const policyPath = path.join(process.cwd(), ".repoready", "policy.yml");
      await fs.mkdir(path.dirname(policyPath), { recursive: true });
      await fs.writeFile(policyPath, content, "utf8");
      console.log(`RepoReady wrote ${policyPath}`);
      process.exit(0);
    }
    if (subcommand !== "check") {
      throw new Error("policy supports only `init` and `check`");
    }
    const policy = await loadPolicy(process.cwd(), defaultPolicy);
    const report = await scanRepository({ cwd: process.cwd() });
    const compliance = checkPolicyCompliance(report, policy);
    console.log(renderPolicyCompliance(compliance, { lang }));
    process.exit(compliance.passed ? 0 : 1);
  }

  if (isDoctor || isTasks || isContext) {
    const cwd = targetArg ? path.resolve(targetArg) : process.cwd();
    const report = targetArg?.includes("github.com")
      ? await scanGitHubRepository(targetArg, { githubToken: process.env.GITHUB_TOKEN })
      : await scanRepository({ cwd });

    if (isDoctor) {
      console.log(renderDoctorReport(report, { lang }));
      process.exit(0);
    }

    if (isTasks) {
      console.log(renderAgentTasks(report, { lang }));
      process.exit(0);
    }

    const contextPack = generateContextPack(report, { lang });
    const diff = buildUnifiedDiff(contextPack.changes);
    if (!write) {
      console.log(diff || "No context files to generate.");
      process.exit(0);
    }
    const written = await writeFixes(cwd, contextPack.changes);
    console.log(`RepoReady wrote ${written.length} context file(s):`);
    for (const file of written) console.log(`- ${file}`);
    process.exit(0);
  }

  if (isFix) {
    const cwd = process.cwd();
    const report = await scanRepository({ cwd });
    const templateKey = readOption("--template");

    if (templateKey) {
      const enhanced = generateFixesWithTemplate(report, templateKey);
      report.fixes = enhanced;
    }
    if (onlyGroups.length) {
      report.fixes = filterFixes(report.fixes, onlyGroups);
    }

    const planned = buildFixPlan(report);
    if (fixPlan) {
      console.log(renderFixPlan(planned, { lang }));
      process.exit(0);
    }
    if (applySafe) {
      report.fixes = { changes: planned.safe, count: planned.safe.length };
    }

    if (createPr) preflightPullRequest();
    if (branch || createPr) createBranch();

    const diff = buildUnifiedDiff(report.fixes.changes);
    if (dryRun && !write) {
      console.log(diff || "No fixes to generate.");
      process.exit(0);
    }

    const written = await writeFixes(cwd, report.fixes.changes);
    console.log(`RepoReady wrote ${written.length} file(s):`);
    for (const file of written) console.log(`- ${file}`);
    if (branch || createPr) console.log("Created/using branch: repoready/fixes");
    if (createPr) openPullRequest(report, baseBranch, written);
    process.exit(0);
  }

  const report = targetArg?.includes("github.com")
    ? await scanGitHubRepository(targetArg, { githubToken: process.env.GITHUB_TOKEN })
    : await scanRepository({ cwd: targetArg ? path.resolve(targetArg) : process.cwd() });
  if (saveBaseline) {
    await saveReportBaseline(report, targetArg ? path.resolve(targetArg) : process.cwd());
  }
  const format = json ? "json" : markdown ? "markdown" : "text";
  console.log(format === "text" ? renderPrettyReport(report, lang) : renderReport(report, { lang, format }));
} catch (error) {
  console.error(`RepoReady error: ${error.message}`);
  process.exit(1);
}

function readOption(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

function parseListOption(name) {
  const value = readOption(name);
  if (!value) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function readTargetArg(values) {
  const optionsWithValues = new Set(["--lang", "--base", "--template", "--only"]);
  for (let i = 0; i < values.length; i += 1) {
    const arg = values[i];
    if (arg === "fix" || arg === "init" || arg === "templates" || arg === "doctor" || arg === "tasks" || arg === "context" || arg === "spec" || arg === "policy" || arg === "check") continue;
    if (optionsWithValues.has(arg)) {
      i += 1;
      continue;
    }
    if (!arg.startsWith("-")) return arg;
  }
  return null;
}

async function loadPolicy(cwd, fallback) {
  const fs = await import("node:fs/promises");
  const policyPath = path.join(cwd, ".repoready", "policy.yml");
  try {
    const text = await fs.readFile(policyPath, "utf8");
    return parsePolicyYaml(text, fallback);
  } catch {
    return fallback;
  }
}

function parsePolicyYaml(text, fallback) {
  const policy = JSON.parse(JSON.stringify(fallback));
  let section = "";
  let listKey = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;

    const sectionMatch = line.match(/^([a-zA-Z_][\w-]*):\s*$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      listKey = "";
      if (!policy[section]) policy[section] = {};
      continue;
    }

    const keyMatch = line.match(/^  ([a-zA-Z_][\w-]*):\s*(true|false)?\s*$/);
    if (keyMatch && section) {
      const key = keyMatch[1];
      if (keyMatch[2]) {
        policy[section][key] = keyMatch[2] === "true";
        listKey = "";
      } else {
        policy[section][key] = [];
        listKey = key;
      }
      continue;
    }

    const itemMatch = line.match(/^    -\s+(.+?)\s*$/);
    if (itemMatch && section && listKey) {
      policy[section][listKey].push(itemMatch[1]);
    }
  }

  return policy;
}

function preflightPullRequest() {
  const repo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (repo.status !== 0) throw new Error("fix --pr requires a git repository");
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" });
  if (remote.status !== 0) throw new Error("fix --pr requires a git remote named origin");
  const gh = spawnSync("gh", ["--version"], { encoding: "utf8" });
  if (gh.status !== 0) throw new Error("fix --pr requires GitHub CLI. Install it and run `gh auth login`.");
}

function createBranch() {
  const check = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" });
  if (check.status !== 0) throw new Error("fix --branch requires a git repository");
  const result = spawnSync("git", ["checkout", "-B", "repoready/fixes"], { stdio: "inherit" });
  if (result.status !== 0) throw new Error("failed to create branch repoready/fixes");
}

function openPullRequest(report, base, written) {
  if (!written.length) {
    console.log("No RepoReady fixes were written; skipping PR creation.");
    return;
  }
  runGit(["add", "--", ...written]);
  const status = spawnSync("git", ["status", "--porcelain", "--", ...written], { encoding: "utf8" });
  if (!status.stdout.trim()) {
    console.log("No RepoReady file changes to commit.");
    return;
  }
  runGit(["commit", "-m", "chore: make repository RepoReady"]);
  runGit(["push", "-u", "origin", "repoready/fixes"]);
  const gh = spawnSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      base,
      "--head",
      "repoready/fixes",
      "--title",
      "chore: make repository RepoReady",
      "--body",
      prBody(report)
    ],
    { encoding: "utf8" }
  );
  if (gh.status !== 0) {
    console.error("GitHub PR creation failed. Install/authenticate GitHub CLI (`gh auth login`) or create the PR manually.");
    console.error(gh.stderr || gh.stdout);
    return;
  }
  console.log(gh.stdout.trim());
}

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`git ${gitArgs.join(" ")} failed`);
}

function prBody(report) {
  const files = report.fixes.changes.map((change) => `- ${change.path}`).join("\n");
  return `Generated by RepoReady.

Overall score: ${report.scores.overall}/100

This PR adds agent instructions, contributor templates, CI/reporting, and documentation improvements so the repository is easier for Codex, Claude Code, Cursor, and contributors to understand.

Generated files:
${files || "- No files"}
`;
}

function renderPrettyReport(report, lang) {
  const zh = lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const localized = (value, fallbackEn, fallbackZh = fallbackEn) => {
    if (!value) return zh ? fallbackZh : fallbackEn;
    if (typeof value === "string") return value;
    return value[zh ? "zh" : "en"] || value.en || value.zh || (zh ? fallbackZh : fallbackEn);
  };
  const lines = [];
  lines.push(`\nRepoReady ${t("Report", "报告")} · ${report.repository.name}`);
  lines.push("=".repeat(Math.min(72, lines[0].length)));
  lines.push(`${t("Overall Score", "总分")}: ${report.scores.overall}/100 ${bar(report.scores.overall)}`);
  lines.push("");
  lines.push(`AI Agent Ready      ${bar(report.scores.agentReady)} ${report.scores.agentReady}/100`);
  lines.push(`Contributor Ready   ${bar(report.scores.contributorReady)} ${report.scores.contributorReady}/100`);
  lines.push(`Context Quality     ${bar(report.scores.contextQuality)} ${report.scores.contextQuality}/100`);
  lines.push(`Safety              ${bar(report.scores.safety)} ${report.scores.safety}/100`);
  lines.push(`Code Quality        ${bar(report.scores.codeQuality || 0)} ${report.scores.codeQuality || 0}/100`);
  lines.push("");
  lines.push(t("Evidence", "证据链"));
  for (const evidence of (report.evidence || []).slice(0, 8)) {
    const mark = evidence.status === "pass" ? "✓" : "!";
    const title = zh ? evidence.titleZh : evidence.title;
    lines.push(`  ${mark} ${title}${evidence.detail ? ` — ${evidence.detail}` : ""}`);
  }
  lines.push("");
  lines.push(t("Score Breakdown", "评分拆解"));
  for (const item of (report.scoreBreakdown?.agentReady || []).slice(0, 4)) {
    lines.push(`  - ${zh ? item.labelZh : item.label}: ${item.earned}/${item.max}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  for (const item of (report.scoreBreakdown?.codeQuality || []).slice(0, 4)) {
    lines.push(`  - ${zh ? item.labelZh : item.label}: ${item.earned}/${item.max}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  lines.push("");
  lines.push(t("Top Issues", "主要问题"));
  const top = report.issues.slice(0, 5);
  if (!top.length) lines.push(`  ${t("No major issues detected.", "未发现主要问题。")}`);
  for (const issue of top) lines.push(`  ${icon(issue.severity)} [${issue.severity}] ${zh ? issue.titleZh : issue.title}`);
  const quick = report.recommendations.filter((r) => r.fixable).slice(0, 5);
  lines.push("");
  lines.push(t("Quick Wins", "快速修复"));
  if (!quick.length) lines.push(`  ${t("No quick fixes required.", "暂无快速修复项。")}`);
  for (const rec of quick) lines.push(`  - ${zh ? rec.zh : rec.en}`);
  const manual = report.recommendations.filter((r) => !r.fixable);
  lines.push("");
  lines.push(t("Manual Review", "人工审查"));
  if (!manual.length) lines.push(`  ${t("No manual review warnings.", "暂无人工审查警告。")}`);
  for (const rec of manual.slice(0, 5)) lines.push(`  - ${zh ? rec.zh : rec.en}`);
  lines.push("");
  lines.push(t("PR-ready Fixes", "可生成 PR 的修复"));
  if (!report.fixes.changes.length) lines.push(`  ${t("No generated fixes required.", "暂无需要生成的修复。")}`);
  for (const change of report.fixes.changes.slice(0, 8)) lines.push(`  + ${change.path}`);
  lines.push("");
  lines.push(t("Next command", "下一步命令"));
  lines.push(`  npx @shidesheng0218/repo-ready fix --dry-run`);

  if (report.deepAnalysis) {
    lines.push("");
    lines.push(t("Deep Analysis", "深度分析"));
    if (report.deepAnalysis.readmeQuality) {
      lines.push(`  README Quality: ${report.deepAnalysis.readmeQuality.grade} (${report.deepAnalysis.readmeQuality.score}/100)`);
      lines.push(`  ${localized(report.deepAnalysis.readmeQuality.summary, "README analysis completed, but no summary was available.", "README 分析已完成，但暂无摘要。")}`);
    }
    if (report.deepAnalysis.dependencyHealth) {
      lines.push(`  Dependencies: ${report.deepAnalysis.dependencyHealth.score}/100`);
      lines.push(`  ${localized(report.deepAnalysis.dependencyHealth.summary, "Dependency analysis completed, but no summary was available.", "依赖分析已完成，但暂无摘要。")}`);
    }
    if (report.deepAnalysis.safetyBoundaries) {
      lines.push(`  Safety Boundaries: ${report.deepAnalysis.safetyBoundaries.score}/100`);
      lines.push(`  ${localized(report.deepAnalysis.safetyBoundaries.summary, "Safety analysis completed, but no summary was available.", "安全边界分析已完成，但暂无摘要。")}`);
      for (const boundary of report.deepAnalysis.safetyBoundaries.boundaries.slice(0, 3)) {
        lines.push(`  - ${zh ? boundary.zh : boundary.en}`);
      }
    }
    if (report.deepAnalysis.taskGraph) {
      lines.push(`  Task Graph: ${report.deepAnalysis.taskGraph.totalTasks} tasks`);
      lines.push(`  ${localized(report.deepAnalysis.taskGraph.summary, "Task analysis completed, but no summary was available.", "任务分析已完成，但暂无摘要。")}`);
    }
  }

  return lines.join("\n");
}

function bar(score) {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function icon(severity) {
  return severity === "high" ? "!" : severity === "medium" ? "›" : "-";
}

function printHelp() {
  console.log(`RepoReady - AI coding agent readiness checker and fixer

Usage:
  repoready [path]
  repoready https://github.com/user/repo
  repoready --lang zh
  repoready --json
  repoready --markdown
  repoready --save-baseline
  repoready spec
  repoready policy init
  repoready policy init --write
  repoready policy check
  repoready doctor
  repoready tasks
  repoready context --dry-run
  repoready context --write
  repoready fix --dry-run
  repoready fix --plan
  repoready fix --apply-safe
  repoready fix --write
  repoready fix --branch
  repoready fix --pr --base main
  repoready fix --template next.js
  repoready fix --only agents
  repoready fix --only readme,ci
  repoready templates
  repoready init
  repoready --ai

Safety:
  Scan never executes repository scripts.
  spec prints the Agent Ready Repository Standard.
  policy init prints or writes a default .repoready/policy.yml.
  policy check evaluates the repository against .repoready/policy.yml when present.
  doctor summarizes diagnosis, strengths, risks, and next step.
  tasks prints copy-ready prompts for Codex, Claude Code, Cursor, and other agents.
  context generates .repo-ready/context files for AI agent collaboration.
  fix --dry-run previews changes.
  fix --plan classifies fixes into safe, review, and manual buckets.
  fix --apply-safe writes only safe automatic fixes.
  fix --write writes generated files only.
  fix --branch creates/uses repoready/fixes.
  fix --pr requires git remote origin and GitHub CLI, then opens a PR without merging it.
  fix --template uses a specific agent template for generated files.
  fix --only limits generated fixes to groups: agents, readme, ci, templates, config.
  repoready templates lists available templates.
  repoready init guides you through interactive repository setup.
  repoready --ai enables AI enhancement (requires OPENAI_API_KEY or ANTHROPIC_API_KEY).`);
}

async function saveReportBaseline(report, cwd) {
  const baseline = {
    version: report.version,
    overall: report.scores.overall,
    agentReady: report.scores.agentReady,
    contributorReady: report.scores.contributorReady,
    contextQuality: report.scores.contextQuality,
    safety: report.scores.safety,
    updatedAt: new Date().toISOString()
  };
  const fs = await import("node:fs/promises");
  const pathMod = await import("node:path");
  const file = pathMod.join(cwd, ".repoready-baseline.json");
  await fs.writeFile(file, JSON.stringify(baseline, null, 2), "utf8");
  console.log(`Saved baseline to ${file}`);
}

async function initInteractive() {
  const cwd = process.cwd();
  console.log(`\nRepoReady Init · ${path.basename(cwd)}\n`);
  const report = await scanRepository({ cwd });
  console.log(`Current score: ${report.scores.overall}/100\n`);
  const answers = await ask([
    { key: "projectName", prompt: "Project name", default: path.basename(cwd) },
    { key: "description", prompt: "One-sentence project description", default: "" },
    { key: "descriptionZh", prompt: "中文简介（可选）", default: "" },
  ]);
  const templateKey = selectTemplate(report.stack);
  console.log(`\nDetected stack: ${report.stack.languages.join(", ") || "Unknown"} ${report.stack.frameworks.join(", ") || ""}`);
  if (templateKey) {
    const useTemplate = await askOne({ key: "useTemplate", prompt: `Use ${templateKey} template? (y/n)`, default: "y" });
    if (useTemplate.toLowerCase() === "y") {
      const enhanced = generateFixesWithTemplate(report, templateKey);
      report.fixes = enhanced;
      console.log(`Applied ${templateKey} template.`);
    }
  }
  console.log(`\n${report.fixes.count} file(s) to generate:`);
  for (const change of report.fixes.changes) console.log(`  + ${change.path}`);
  const writeAnswer = await askOne({ key: "write", prompt: "Write these files now? (y/n)", default: "y" });
  if (writeAnswer.toLowerCase() !== "y") {
    console.log("Skipped writing. Run repoready fix --write later.");
    return;
  }
  const written = await writeFixes(cwd, report.fixes.changes);
  console.log(`\nWrote ${written.length} file(s):`);
  for (const file of written) console.log(`  - ${file}`);
  console.log(`\nDone. Score: ${report.scores.overall}/100`);
}

function selectTemplate(stack) {
  if (stack.frameworks.includes("Next.js")) return "next.js";
  if (stack.frameworks.includes("Vue")) return "vue";
  if (stack.languages.includes("Python")) return "python";
  if (stack.languages.includes("Rust")) return "rust";
  if (stack.languages.includes("Go")) return "go";
  if (stack.frameworks.includes("monorepo/workspace")) return "monorepo/workspace";
  return null;
}

async function ask(questions) {
  const results = {};
  for (const q of questions) {
    results[q.key] = await askOne(q);
  }
  return results;
}

function askOne({ prompt, default: def }) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const label = def ? `${prompt} [${def}]: ` : `${prompt}: `;
  return new Promise((resolve) => {
    rl.question(label, (answer) => {
      rl.close();
      resolve(answer.trim() || def);
    });
  });
}
