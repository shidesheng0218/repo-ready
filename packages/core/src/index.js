import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";

const IGNORE_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage", ".turbo", ".cache", "vendor"]);
const GENERATED_DIRS = new Set(["node_modules", "dist", "build", "coverage", ".next", ".turbo", ".cache", "out", "target"]);
const DANGEROUS_PATTERNS = [
  { pattern: /rm\s+-rf\s+(\/|\.|\*|~|\$\{?\w+\}?)/i, label: "destructive delete" },
  { pattern: /git\s+push\s+.*--force/i, label: "force push" },
  { pattern: /(drop|reset|truncate)\s+(database|db|schema|table)/i, label: "database reset/drop" },
  { pattern: /(deploy|release).*(prod|production)/i, label: "production deploy" },
  { pattern: /chmod\s+777/i, label: "unsafe permissions" },
  { pattern: /curl\s+.*\|\s*(sh|bash)/i, label: "remote script execution" }
];

const AGENT_TEMPLATES = {
  "next.js": {
    name: "Next.js",
    agentsMd: buildTemplateAgentsMd("Next.js", "pnpm", "pnpm dev", "pnpm test", "pnpm build", "pnpm lint", [
      "Use the App Router file convention (`app/` directory).",
      "Prefer Server Components by default; add 'use client' only when necessary.",
      "Keep page components small and delegate data fetching to server-side helpers.",
      "Use Tailwind CSS for styling when the project is configured with it."
    ]),
    claudeMd: buildTemplateClaudeMd("Next.js", "pnpm", "pnpm dev", "pnpm test", "pnpm build", "pnpm lint"),
    cursorRules: "Always prefer Server Components. Use `app/` directory routing. Prefer TypeScript strict mode."
  },
  vue: {
    name: "Vue",
    agentsMd: buildTemplateAgentsMd("Vue", "pnpm", "pnpm dev", "pnpm test:unit", "pnpm build", "pnpm lint", [
      "Use Composition API with `<script setup>` as the default style.",
      "Keep components focused on a single responsibility.",
      "Use Pinia for state management when needed."
    ]),
    claudeMd: buildTemplateClaudeMd("Vue", "pnpm", "pnpm dev", "pnpm test:unit", "pnpm build", "pnpm lint"),
    cursorRules: "Default to Composition API with `<script setup>`. Use Pinia for stores. Prefer TypeScript."
  },
  python: {
    name: "Python",
    agentsMd: buildTemplateAgentsMd("Python", "pip", "pip install -e .", "pytest", "pip install -e .", "ruff check .", [
      "Use type hints for all public functions.",
      "Keep modules small and cohesive.",
      "Use `pathlib` for filesystem operations."
    ]),
    claudeMd: buildTemplateClaudeMd("Python", "pip", "pip install -e .", "pytest", "pip install -e .", "ruff check ."),
    cursorRules: "Use type hints. Prefer dataclasses or Pydantic. Use pytest for testing."
  },
  rust: {
    name: "Rust",
    agentsMd: buildTemplateAgentsMd("Rust", "cargo", "cargo run", "cargo test", "cargo build", "cargo clippy", [
      "Follow Rust API guidelines.",
      "Use `anyhow` for application errors and `thiserror` for library errors.",
      "Keep functions small and avoid excessive indirection."
    ]),
    claudeMd: buildTemplateClaudeMd("Rust", "cargo", "cargo run", "cargo test", "cargo build", "cargo clippy"),
    cursorRules: "Use cargo clippy and cargo fmt. Follow Rust API guidelines. Prefer edition 2024."
  },
  go: {
    name: "Go",
    agentsMd: buildTemplateAgentsMd("Go", "go", "go run .", "go test ./...", "go build ./...", "go vet ./...", [
      "Follow Effective Go conventions.",
      "Keep packages focused and avoid import cycles.",
      "Use `context.Context` for cancellation and deadlines."
    ]),
    claudeMd: buildTemplateClaudeMd("Go", "go", "go run .", "go test ./...", "go build ./...", "go vet ./..."),
    cursorRules: "Follow Effective Go. Use go vet. Prefer explicit error handling."
  },
  "monorepo/workspace": {
    name: "monorepo/workspace",
    agentsMd: buildTemplateAgentsMd("monorepo", "pnpm", "pnpm dev", "pnpm test", "pnpm build", "pnpm lint", [
      "Work in one package at a time unless the change spans multiple packages.",
      "Document which workspace(s) are affected in each PR.",
      "Use shared lint and test configurations from the root."
    ]),
    claudeMd: buildTemplateClaudeMd("monorepo", "pnpm", "pnpm dev", "pnpm test", "pnpm build", "pnpm lint"),
    cursorRules: "Work in one workspace at a time. Use root-level lint and test configs."
  }
};

function buildTemplateAgentsMd(label, pm, dev, test, build, lint, extras) {
  return `# AGENTS.md

Guidance for Codex, Claude Code, Cursor, and other AI coding agents working in this repository.

## Project overview
- Primary stack: ${label}
- Package manager: ${pm}

## Common commands
- Install: ${pm === "pnpm" ? "pnpm install" : pm === "cargo" ? "cargo build" : pm === "go" ? "go mod tidy" : `${pm} install`}
- Dev: ${dev}
- Test: ${test}
- Build: ${build}
- Lint: ${lint}

## Agent rules
- Prefer small, reviewable changes.
- Do not run destructive, deployment, database reset, or force-push commands unless explicitly approved by a maintainer.
- Update tests or documentation when behavior changes.
- If a command is missing or unclear, ask for clarification instead of guessing.
${extras.map((ex) => `- ${ex}`).join("\n")}

## 中文说明
本文件用于帮助 Codex、Claude Code、Cursor 等 AI 编程代理理解项目。请优先进行小范围、可审查的修改；不要在未经维护者明确授权时运行破坏性、部署、数据库重置或强制推送命令。
`;
}

function buildTemplateClaudeMd(label, pm, dev, test, build, lint) {
  return `# CLAUDE.md

Guidance for Claude Code working in this repository.

## Stack
- Primary: ${label}
- Package manager: ${pm}

## Commands
- Install: ${pm} install
- Dev: ${dev}
- Test: ${test}
- Build: ${build}
- Lint: ${lint}

## Rules
- Keep changes small and reviewable.
- Do not run destructive or deployment commands unless explicitly approved.
- When in doubt, ask for clarification.
`;
}

export const VERSION = "0.1.0";

export async function scanRepository(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const files = await collectFiles(cwd, options.maxFiles || 1800);
  const fileSet = new Set(files.map((file) => normalize(file.relative)));
  const manifests = await readManifests(cwd, fileSet);
  const readme = await readFirstExisting(cwd, ["README.md", "readme.md", "README", "README.zh-CN.md"]);
  const gitignore = await readFirstExisting(cwd, [".gitignore"]);
  const repoHealth = detectRepoHealth(fileSet);
  const agentFiles = detectAgentFiles(fileSet);
  const stack = detectStack(fileSet, manifests);
  const commands = detectCommands(manifests, stack, fileSet);
  const dangerousScripts = detectDangerousScripts(manifests, fileSet);
  const contextNoise = detectContextNoise(files, gitignore?.content || "");
  const readmeSignals = analyzeReadme(readme?.content || "");
  const issues = buildIssues({ agentFiles, commands, dangerousScripts, contextNoise, readmeSignals, fileSet, repoHealth });
  const scores = calculateScores({ agentFiles, commands, dangerousScripts, contextNoise, readmeSignals, fileSet, repoHealth });
  const recommendations = buildRecommendations(issues);
  const taskSuggestions = buildTaskSuggestions({ stack, commands, issues });
  const fixes = generateFixes({ stack, commands, readme, readmeSignals, agentFiles, fileSet, scores, repoHealth });

  const templates = matchTemplates(stack);

  const deepAnalysis = {
    readmeQuality: analyzeReadmeQuality(readme?.content || ""),
    dependencyHealth: analyzeDependencyHealth(manifests, fileSet),
    safetyBoundaries: analyzeSafetyBoundaries(fileSet, dangerousScripts, repoHealth),
    taskGraph: analyzeTaskGraph(stack, commands, fileSet, readmeSignals, agentFiles, issues)
  };

  const aiEnhancements = await applyAiEnhancements(deepAnalysis, stack, commands, fixes, options, cwd);
  const baseline = await loadBaseline(cwd);
  const scoreComparison = compareToBaseline(scores, baseline);

  return {
    version: VERSION,
    scannedAt: new Date().toISOString(),
    repository: { root: cwd, name: path.basename(cwd), source: "local" },
    stack,
    commands,
    agentFiles,
    repoHealth,
    readme: readmeSignals,
    contextNoise,
    dangerousScripts,
    scores,
    issues,
    recommendations,
    taskSuggestions,
    fixes
    ,
    templates
    ,
    deepAnalysis
    ,
    aiEnhancements,
    scoreComparison,
    baseline
  };
}

export async function scanGitHubRepository(repoUrl, options = {}) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  const headers = { "User-Agent": "RepoReady" };
  if (options.githubToken) headers.Authorization = `Bearer ${options.githubToken}`;
  const treeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/HEAD?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers });
  if (!treeRes.ok) throw new Error(`GitHub tree fetch failed: ${treeRes.status} ${treeRes.statusText}`);
  const tree = await treeRes.json();
  const allowed = ["package.json", "pnpm-workspace.yaml", "README.md", "readme.md", ".gitignore", "pyproject.toml", "Cargo.toml", "go.mod", "AGENTS.md", "CLAUDE.md", ".cursor/rules"];
  const temp = await fs.mkdtemp(path.join(process.cwd(), ".repoready-github-"));
  try {
    for (const item of tree.tree || []) {
      if (item.type !== "blob") continue;
      if (!allowed.includes(item.path) && !item.path.startsWith(".github/")) continue;
      const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/${item.path}`;
      const raw = await fetch(rawUrl, { headers });
      if (!raw.ok) continue;
      const target = path.join(temp, item.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, await raw.text(), "utf8");
    }
    const report = await scanRepository({ cwd: temp, maxFiles: options.maxFiles });
    report.repository = { root: repoUrl, name: `${parsed.owner}/${parsed.repo}`, source: "github", owner: parsed.owner, repo: parsed.repo };
    return report;
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

export function parseGitHubUrl(value) {
  const match = String(value).match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function collectFiles(root, maxFiles) {
  const out = [];
  async function walk(dir) {
    if (out.length >= maxFiles) return;
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = normalize(path.relative(root, absolute));
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        await walk(absolute);
      } else if (entry.isFile()) {
        let stat;
        try {
          stat = await fs.stat(absolute);
        } catch {
          continue;
        }
        out.push({ absolute, relative, size: stat.size });
        if (out.length >= maxFiles) return;
      }
    }
  }
  await walk(root);
  return out;
}

async function readManifests(cwd, fileSet) {
  const manifests = {};
  if (fileSet.has("package.json")) manifests.packageJson = await readJson(path.join(cwd, "package.json"));
  if (fileSet.has("composer.json")) manifests.composerJson = await readJson(path.join(cwd, "composer.json"));
  if (fileSet.has("pyproject.toml")) manifests.pyproject = await readText(path.join(cwd, "pyproject.toml"));
  if (fileSet.has("cargo.toml")) manifests.cargo = await readText(path.join(cwd, "Cargo.toml"));
  if (fileSet.has("go.mod")) manifests.goMod = await readText(path.join(cwd, "go.mod"));
  if (fileSet.has("pom.xml")) manifests.pom = await readText(path.join(cwd, "pom.xml"));
  if (fileSet.has("build.gradle")) manifests.gradle = await readText(path.join(cwd, "build.gradle"));
  return manifests;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function readText(file) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
}

async function readFirstExisting(cwd, names) {
  for (const name of names) {
    const content = await readText(path.join(cwd, name));
    if (content != null) return { path: name, content };
  }
  return null;
}

function normalize(value) {
  return value.replaceAll("\\", "/").toLowerCase();
}

function detectAgentFiles(fileSet) {
  const cursorRules = fileSet.has(".cursor/rules") || [...fileSet].some((f) => f.startsWith(".cursor/rules"));
  return {
    agentsMd: fileSet.has("agents.md"),
    claudeMd: fileSet.has("claude.md"),
    cursorRules,
    any: fileSet.has("agents.md") || fileSet.has("claude.md") || cursorRules
  };
}

function detectRepoHealth(fileSet) {
  const workflows = [...fileSet].filter((file) => file.startsWith(".github/workflows/") && (file.endsWith(".yml") || file.endsWith(".yaml")));
  const envFiles = [...fileSet].filter((file) => /(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".example") && !file.endsWith(".sample"));
  return {
    hasGitignore: fileSet.has(".gitignore"),
    hasLicense: fileSet.has("license") || fileSet.has("license.md") || fileSet.has("license.txt"),
    hasEnvExample: fileSet.has(".env.example") || fileSet.has(".env.sample"),
    envFiles,
    hasCi: workflows.length > 0,
    workflows,
    hasIssueTemplate: [...fileSet].some((file) => file.startsWith(".github/issue_template/")),
    hasPrTemplate: fileSet.has(".github/pull_request_template.md"),
    hasContributing: fileSet.has("contributing.md") || fileSet.has("docs/contributing.md")
  };
}

function detectStack(fileSet, manifests) {
  const languages = [];
  const frameworks = [];
  let packageManager = "unknown";
  if (fileSet.has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (fileSet.has("yarn.lock")) packageManager = "yarn";
  else if (fileSet.has("package-lock.json")) packageManager = "npm";
  else if (fileSet.has("package.json")) packageManager = "npm";
  if (fileSet.has("package.json")) languages.push("JavaScript/TypeScript");
  if (fileSet.has("pyproject.toml") || fileSet.has("requirements.txt")) languages.push("Python");
  if (fileSet.has("cargo.toml")) languages.push("Rust");
  if (fileSet.has("go.mod")) languages.push("Go");
  if (fileSet.has("pom.xml") || fileSet.has("build.gradle") || fileSet.has("settings.gradle")) languages.push("Java/Kotlin");
  if (fileSet.has("composer.json")) languages.push("PHP");
  if ([...fileSet].some((f) => f.endsWith(".csproj") || f.endsWith(".sln"))) languages.push(".NET");
  if (fileSet.has("gemfile")) languages.push("Ruby");
  if (fileSet.has("pnpm-workspace.yaml") || fileSet.has("turbo.json") || fileSet.has("nx.json") || manifests.packageJson?.workspaces) frameworks.push("monorepo/workspace");
  const deps = { ...(manifests.packageJson?.dependencies || {}), ...(manifests.packageJson?.devDependencies || {}) };
  if (deps.next) frameworks.push("Next.js");
  if (deps.react) frameworks.push("React");
  if (deps.vue) frameworks.push("Vue");
  if (deps.vitest) frameworks.push("Vitest");
  if (deps.jest) frameworks.push("Jest");
  if (deps.playwright) frameworks.push("Playwright");
  if (deps["@playwright/test"]) frameworks.push("Playwright");
  if (manifests.pyproject?.includes("pytest")) frameworks.push("pytest");
  if (manifests.pyproject?.includes("ruff")) frameworks.push("Ruff");
  if (manifests.composerJson?.require?.laravel || manifests.composerJson?.require?.["laravel/framework"]) frameworks.push("Laravel");
  if (manifests.pom?.includes("spring-boot")) frameworks.push("Spring Boot");
  return { languages, frameworks, packageManager };
}

function detectCommands(manifests, stack, fileSet) {
  const scripts = manifests.packageJson?.scripts || {};
  const inferred = inferCommands(stack, fileSet, manifests);
  return {
    dev: scripts.dev || scripts.start || inferred.dev || null,
    test: scripts.test || inferred.test || null,
    build: scripts.build || scripts["web:build"] || inferred.build || null,
    lint: scripts.lint || inferred.lint || null,
    scripts,
    inferred
  };
}

function inferCommands(stack, fileSet, manifests) {
  if (stack.languages.includes("Rust")) return { test: "cargo test", build: "cargo build", lint: "cargo clippy" };
  if (stack.languages.includes("Go")) return { test: "go test ./...", build: "go build ./...", lint: "go vet ./..." };
  if (stack.languages.includes("Python")) {
    const test = manifests.pyproject?.includes("pytest") || fileSet.has("pytest.ini") ? "pytest" : "python -m unittest";
    return { test, lint: manifests.pyproject?.includes("ruff") ? "ruff check ." : null };
  }
  if (stack.languages.includes("Java/Kotlin")) {
    if (fileSet.has("pom.xml")) return { test: "mvn test", build: "mvn package" };
    return { test: "gradle test", build: "gradle build" };
  }
  if (stack.languages.includes("PHP")) return { test: "composer test", build: null, lint: "composer lint" };
  if (stack.languages.includes(".NET")) return { test: "dotnet test", build: "dotnet build" };
  return {};
}

function detectDangerousScripts(manifests, fileSet) {
  const scripts = manifests.packageJson?.scripts || {};
  const found = [];
  for (const [name, command] of Object.entries(scripts)) {
    for (const rule of DANGEROUS_PATTERNS) {
      if (rule.pattern.test(String(command))) found.push({ name, command, reason: rule.label, severity: "high" });
    }
  }
  for (const file of fileSet) {
    if (/(^|\/)\.env($|\.)/.test(file) && !file.endsWith(".example") && !file.endsWith(".sample")) {
      found.push({ name: file, command: "committed environment file", reason: "sensitive env file", severity: "high" });
    }
  }
  return found;
}

function detectContextNoise(files, gitignore) {
  const foundGenerated = [];
  const largeFiles = [];
  const ignoredText = gitignore.toLowerCase();
  for (const file of files) {
    const parts = file.relative.split("/");
    const generated = parts.find((part) => GENERATED_DIRS.has(part));
    if (generated) foundGenerated.push(file.relative);
    if (file.size > 1024 * 1024) largeFiles.push({ path: file.relative, size: file.size });
  }
  const missingIgnoreRules = [...GENERATED_DIRS].filter((dir) => !ignoredText.includes(dir));
  return {
    generatedFilesTracked: foundGenerated.slice(0, 20),
    largeFiles: largeFiles.slice(0, 20),
    missingIgnoreRules: missingIgnoreRules.slice(0, 10),
    fileCount: files.length
  };
}

function analyzeReadme(content) {
  const text = content.toLowerCase();
  return {
    exists: content.length > 0,
    hasInstall: /install|installation|setup|安装|部署/.test(text),
    hasUsage: /usage|quick start|getting started|example|用法|快速开始/.test(text),
    hasQuickStart: /quick start|getting started|快速开始|start here/.test(text),
    hasTest: /test|testing|测试/.test(text),
    hasContributing: /contribut|贡献|参与/.test(text),
    hasLicense: /license|许可证/.test(text),
    hasBadge: /!\[.*?\]\(.*?\)|img\.shields\.io|badge/.test(content),
    hasDemo: /demo|screenshot|preview|gif|video|演示|截图|预览/.test(text),
    hasRoadmap: /roadmap|todo|milestone|路线图|计划/.test(text),
    hasApiDocs: /api|configuration|config|options|cli|参数|配置/.test(text),
    bilingual: /[\u4e00-\u9fff]/.test(content) && /[a-zA-Z]{30,}/.test(content),
    length: content.length
  };
}

function buildIssues(input) {
  const issues = [];
  const add = (id, category, severity, title, titleZh, fixable = true) => issues.push({ id, category, severity, title, titleZh, fixable });
  if (!input.agentFiles.any) add("missing-agent-instructions", "agent", "high", "Missing AGENTS.md / CLAUDE.md / Cursor rules", "缺少 AGENTS.md / CLAUDE.md / Cursor 规则");
  if (!input.commands.test) add("missing-test-command", "agent", "high", "No test command was detected", "未检测到测试命令");
  if (!input.commands.build) add("missing-build-command", "agent", "medium", "No build command was detected", "未检测到构建命令");
  if (!input.readmeSignals.exists) add("missing-readme", "contributor", "high", "README is missing", "缺少 README");
  if (input.readmeSignals.exists && !input.readmeSignals.hasInstall) add("readme-install", "contributor", "medium", "README lacks installation instructions", "README 缺少安装说明");
  if (input.readmeSignals.exists && !input.readmeSignals.hasUsage) add("readme-usage", "contributor", "medium", "README lacks usage or quick start instructions", "README 缺少用法或快速开始说明");
  if (input.readmeSignals.exists && !input.readmeSignals.hasDemo) add("readme-demo", "contributor", "low", "README lacks a demo, screenshot, or preview", "README 缺少演示、截图或预览");
  if (input.readmeSignals.exists && !input.readmeSignals.hasBadge) add("readme-badge", "contributor", "low", "README lacks visible status badges", "README 缺少可见状态徽章");
  if (!input.readmeSignals.hasContributing) add("missing-contributing", "contributor", "low", "Contribution guidance is missing", "缺少贡献说明");
  if (!input.repoHealth.hasLicense && !input.readmeSignals.hasLicense) add("missing-license", "contributor", "medium", "License is missing or not documented", "缺少 License 或许可证说明");
  if (!input.repoHealth.hasCi) add("missing-ci", "contributor", "medium", "No GitHub Actions workflow was detected", "未检测到 GitHub Actions 工作流");
  if (!input.repoHealth.hasGitignore) add("missing-gitignore", "context", "medium", ".gitignore is missing", "缺少 .gitignore");
  if (input.repoHealth.envFiles.length) add("committed-env-file", "safety", "high", "Environment files appear to be committed", "检测到可能被提交的环境变量文件", false);
  if (!input.repoHealth.hasEnvExample) add("missing-env-example", "contributor", "low", ".env.example is missing", "缺少 .env.example 示例文件");
  if (input.dangerousScripts.length) add("dangerous-scripts", "safety", "high", "Potentially dangerous scripts were detected", "检测到潜在危险脚本", false);
  if (input.contextNoise.generatedFilesTracked.length) add("tracked-generated-files", "context", "medium", "Generated/cache files appear in repository context", "仓库上下文中出现生成物或缓存文件", false);
  if (input.contextNoise.largeFiles.length) add("large-files", "context", "medium", "Large files may overload AI agent context", "大文件可能导致 AI agent 上下文过载", false);
  return issues;
}

function calculateScores({ agentFiles, commands, dangerousScripts, contextNoise, readmeSignals, fileSet, repoHealth }) {
  const dimensions = {
    agentReady: {
      score: weightedScore([
        { value: agentFiles.agentsMd, weight: 0.28, type: "boolean" },
        { value: agentFiles.claudeMd, weight: 0.08, type: "boolean" },
        { value: agentFiles.cursorRules, weight: 0.08, type: "boolean" },
        { value: commands.test, weight: 0.20, type: "presence" },
        { value: commands.build, weight: 0.15, type: "presence" },
        { value: readmeSignals.hasUsage, weight: 0.08, type: "boolean" },
        { value: repoHealth.hasCi, weight: 0.13, type: "boolean" }
      ]),
      confidence: calculateConfidence([
        agentFiles.agentsMd,
        agentFiles.claudeMd,
        agentFiles.cursorRules,
        commands.test,
        commands.build,
        readmeSignals.hasUsage,
        repoHealth.hasCi
      ])
    },
    contributorReady: {
      score: weightedScore([
        { value: readmeSignals.exists, weight: 0.14, type: "boolean" },
        { value: readmeSignals.hasInstall, weight: 0.15, type: "boolean" },
        { value: readmeSignals.hasUsage, weight: 0.15, type: "boolean" },
        { value: readmeSignals.hasDemo, weight: 0.10, type: "boolean" },
        { value: readmeSignals.hasBadge, weight: 0.05, type: "boolean" },
        { value: readmeSignals.hasTest, weight: 0.10, type: "boolean" },
        { value: readmeSignals.hasContributing, weight: 0.10, type: "boolean" },
        { value: repoHealth.hasIssueTemplate, weight: 0.08, type: "boolean" },
        { value: repoHealth.hasPrTemplate, weight: 0.08, type: "boolean" },
        { value: repoHealth.hasLicense || fileSet.has("license"), weight: 0.05, type: "boolean" }
      ]),
      confidence: calculateConfidence([
        readmeSignals.exists,
        readmeSignals.hasInstall,
        readmeSignals.hasUsage,
        readmeSignals.hasDemo,
        readmeSignals.hasBadge,
        readmeSignals.hasTest,
        readmeSignals.hasContributing,
        repoHealth.hasIssueTemplate,
        repoHealth.hasPrTemplate,
        repoHealth.hasLicense || fileSet.has("license")
      ])
    },
    contextQuality: {
      score: weightedScore([
        { value: 100 - Math.min(25, contextNoise.generatedFilesTracked.length * 3), weight: 0.35, type: "numeric" },
        { value: 100 - Math.min(25, contextNoise.largeFiles.length * 8), weight: 0.30, type: "numeric" },
        { value: 100 - Math.min(15, contextNoise.missingIgnoreRules.length * 2), weight: 0.20, type: "numeric" },
        { value: repoHealth.hasGitignore ? 100 : 0, weight: 0.10, type: "numeric" },
        { value: contextNoise.fileCount > 1200 ? 80 : 100, weight: 0.05, type: "numeric" }
      ]),
      confidence: calculateConfidence([
        contextNoise.generatedFilesTracked.length === 0,
        contextNoise.largeFiles.length === 0,
        repoHealth.hasGitignore,
        contextNoise.fileCount <= 1200
      ])
    },
    safety: {
      score: weightedScore([
        { value: 100 - Math.min(70, dangerousScripts.length * 25), weight: 0.60, type: "numeric" },
        { value: repoHealth.envFiles.length ? 0 : 100, weight: 0.40, type: "numeric" }
      ]),
      confidence: calculateConfidence([
        dangerousScripts.length === 0,
        repoHealth.envFiles.length === 0
      ])
    }
  };

  let agent = dimensions.agentReady.score;
  let contributor = dimensions.contributorReady.score;
  let context = dimensions.contextQuality.score;
  let safety = dimensions.safety.score;
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  const scores = {
    agentReady: clamp(agent),
    contributorReady: clamp(contributor),
    contextQuality: clamp(context),
    safety: clamp(safety),
    confidence: {
      agentReady: dimensions.agentReady.confidence,
      contributorReady: dimensions.contributorReady.confidence,
      contextQuality: dimensions.contextQuality.confidence,
      safety: dimensions.safety.confidence
    }
  };
  scores.overall = clamp((scores.agentReady + scores.contributorReady + scores.contextQuality + scores.safety) / 4);
  return scores;
}

function buildRecommendations(issues) {
  return issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    fixable: issue.fixable,
    en: recommendationText(issue, "en"),
    zh: recommendationText(issue, "zh")
  }));
}

function weightedScore(items) {
  let total = 0;
  let weightSum = 0;
  for (const item of items) {
    const value = item.type === "boolean" || item.type === "presence" ? (item.value ? 100 : 0) : Number(item.value || 0);
    total += value * item.weight;
    weightSum += item.weight;
  }
  return weightSum > 0 ? total / weightSum : 0;
}

function calculateConfidence(signals) {
  if (!signals.length) return 0.5;
  const positive = signals.filter(Boolean).length;
  const ratio = positive / signals.length;
  return Math.max(0.35, Math.min(0.98, Math.round(ratio * 100) / 100));
}

function recommendationText(issue, lang) {
  const map = {
    "missing-agent-instructions": ["Add AGENTS.md with project structure, commands, coding rules, and safety notes.", "添加 AGENTS.md，说明项目结构、命令、编码规范和安全注意事项。"],
    "missing-test-command": ["Document or add a test command so agents can validate changes.", "补充或说明测试命令，方便 agent 验证修改。"],
    "missing-build-command": ["Document or add a build command so agents can check production readiness.", "补充或说明构建命令，方便 agent 检查生产可用性。"],
    "missing-readme": ["Add a README with install, usage, test, and contribution sections.", "添加 README，包含安装、用法、测试和贡献说明。"],
    "readme-install": ["Add installation/setup instructions to README.", "在 README 中添加安装或环境准备说明。"],
    "readme-usage": ["Add quick start or usage examples to README.", "在 README 中添加快速开始或用法示例。"],
    "readme-demo": ["Add a screenshot, demo GIF, or preview so visitors understand the project faster.", "添加截图、演示 GIF 或预览，让访问者更快理解项目。"],
    "readme-badge": ["Add visible badges for RepoReady, CI, license, or package status.", "添加 RepoReady、CI、License 或包状态徽章。"],
    "missing-contributing": ["Add contribution guidance or a short contributor section.", "添加贡献说明或简短贡献者指南。"],
    "missing-license": ["Add a LICENSE file or document the license clearly in README.", "添加 LICENSE 文件，或在 README 中清楚说明许可证。"],
    "missing-ci": ["Add a GitHub Actions workflow so contributors and agents can validate changes.", "添加 GitHub Actions 工作流，方便贡献者和 agent 验证修改。"],
    "missing-gitignore": ["Add a .gitignore to keep caches, builds, and secrets out of repository context.", "添加 .gitignore，避免缓存、构建产物和敏感文件进入仓库上下文。"],
    "committed-env-file": ["Remove committed environment files and provide a safe .env.example instead.", "移除已提交的环境变量文件，并提供安全的 .env.example 示例。"],
    "missing-env-example": ["Add .env.example when the project needs environment variables.", "如果项目需要环境变量，添加 .env.example 示例文件。"],
    "dangerous-scripts": ["Review dangerous scripts manually and document safe usage.", "人工检查危险脚本，并说明安全使用方式。"],
    "tracked-generated-files": ["Keep generated/cache folders out of repository context and update .gitignore.", "避免生成物/缓存目录进入仓库上下文，并更新 .gitignore。"],
    "large-files": ["Move large artifacts out of source control or document why they are needed.", "移出大型产物文件，或说明其必要性。"]
  };
  const fallback = [issue.title, issue.titleZh];
  return (map[issue.id] || fallback)[lang === "zh" ? 1 : 0];
}

function buildTaskSuggestions({ stack, issues }) {
  const suggestions = [
    { en: "Ask an agent to add or refine small documentation sections first.", zh: "优先让 agent 补充或优化小范围文档。" },
    { en: "Ask an agent to run tests after code changes when a test command exists.", zh: "如果存在测试命令，让 agent 在代码修改后运行测试。" }
  ];
  if (stack.languages.includes("JavaScript/TypeScript")) suggestions.push({ en: "Good agent tasks: add unit tests, type guards, lint fixes, and README examples.", zh: "适合 agent 的任务：补单元测试、类型保护、lint 修复、README 示例。" });
  if (stack.languages.includes("Python")) suggestions.push({ en: "Good agent tasks: add pytest coverage, type hints, Ruff fixes, and CLI examples.", zh: "适合 agent 的任务：补 pytest 覆盖、类型标注、Ruff 修复和 CLI 示例。" });
  if (stack.frameworks.includes("monorepo/workspace")) suggestions.push({ en: "For monorepos, ask agents to work in one package at a time and document affected workspaces.", zh: "对于 monorepo，要求 agent 一次只处理一个包，并说明影响的 workspace。" });
  if (issues.some((i) => i.id === "dangerous-scripts")) suggestions.push({ en: "Avoid asking agents to run deployment, reset, or destructive scripts without review.", zh: "不要让 agent 在未审查时运行部署、重置或破坏性脚本。" });
  if (issues.some((i) => i.id === "missing-ci")) suggestions.push({ en: "Ask an agent to add a minimal CI workflow before larger code changes.", zh: "在进行较大代码修改前，先让 agent 添加最小 CI 工作流。" });
  return suggestions;
}

export function generateFixes({ stack, commands, readme, readmeSignals, agentFiles, fileSet, scores, repoHealth = {} }) {
  const changes = [];
  if (!agentFiles.agentsMd) changes.push({ path: "AGENTS.md", action: "create", content: buildAgentsMd({ stack, commands }) });
  const readmePatch = buildReadme(readme?.content, { readmeSignals, commands, scores });
  if (readmePatch) changes.push({ path: readme?.path || "README.md", action: readme ? "update" : "create", content: readmePatch });
  if (!repoHealth.hasGitignore) changes.push({ path: ".gitignore", action: "create", content: buildGitignore() });
  if (!repoHealth.hasEnvExample) changes.push({ path: ".env.example", action: "create", content: "# Add required environment variables here.\n# Example:\n# GITHUB_TOKEN=\n" });
  if (!fileSet.has(".github/workflows/repoready.yml")) changes.push({ path: ".github/workflows/repoready.yml", action: "create", content: buildWorkflow(commands) });
  if (!fileSet.has(".github/issue_template/bug_report.md")) changes.push({ path: ".github/ISSUE_TEMPLATE/bug_report.md", action: "create", content: buildIssueTemplate() });
  if (!fileSet.has(".github/pull_request_template.md")) changes.push({ path: ".github/pull_request_template.md", action: "create", content: buildPrTemplate() });
  return { changes, count: changes.length };
}

function buildAgentsMd({ stack, commands }) {
  return `# AGENTS.md

Guidance for Codex, Claude Code, Cursor, and other AI coding agents working in this repository.

## Project overview
- Languages: ${stack.languages.join(", ") || "Unknown"}
- Frameworks: ${stack.frameworks.join(", ") || "Unknown"}
- Package manager: ${stack.packageManager}

## Common commands
- Install: ${stack.packageManager === "pnpm" ? "pnpm install" : stack.packageManager === "yarn" ? "yarn install" : stack.packageManager === "npm" ? "npm install" : "document project-specific install command"}
- Dev: ${commands.dev || "document project-specific dev command"}
- Test: ${commands.test || "document project-specific test command"}
- Build: ${commands.build || "document project-specific build command"}
- Lint: ${commands.lint || "document project-specific lint command"}

## Agent rules
- Prefer small, reviewable changes.
- Do not run destructive, deployment, database reset, or force-push commands unless explicitly approved by a maintainer.
- Update tests or documentation when behavior changes.
- If a command is missing or unclear, ask for clarification instead of guessing.

## 中文说明
本文件用于帮助 Codex、Claude Code、Cursor 等 AI 编程代理理解项目。请优先进行小范围、可审查的修改；不要在未经维护者明确授权时运行破坏性、部署、数据库重置或强制推送命令。
`;
}

function buildReadme(existing, { readmeSignals, commands, scores }) {
  const badge = `![RepoReady](https://img.shields.io/badge/RepoReady-${scores.overall}%2F100-blue)`;
  if (!existing || !existing.trim()) {
    return `# Project name

${badge}

> Add a one-sentence project description.
>
> 请添加一句话项目简介。

## Installation

\`\`\`bash
# Add install command here
\`\`\`

## Usage

\`\`\`bash
# Add usage command here
\`\`\`

## Demo

Add a screenshot, GIF, or short terminal recording here.

## Testing

\`\`\`bash
${commands.test || "# Add test command here"}
\`\`\`

## Contributing

Issues and pull requests are welcome. Please keep changes small and include tests or documentation updates when relevant.

欢迎提交 issue 和 pull request。请保持修改小而清晰，并在需要时补充测试或文档。

## Roadmap

- [ ] Document the first practical use case.
- [ ] Add examples for common workflows.
`;
  }
  let content = existing;
  if (!readmeSignals.hasBadge) content = content.replace(/^(# .+\n)/, `$1\n${badge}\n`);
  const append = [];
  if (!readmeSignals.hasInstall) append.push("## Installation\n\n```bash\n# Add install command here\n```\n");
  if (!readmeSignals.hasUsage) append.push("## Usage\n\n```bash\n# Add usage command here\n```\n");
  if (!readmeSignals.hasDemo) append.push("## Demo\n\nAdd a screenshot, GIF, or short terminal recording here.\n");
  if (!readmeSignals.hasTest) append.push(`## Testing\n\n\`\`\`bash\n${commands.test || "# Add test command here"}\n\`\`\`\n`);
  if (!readmeSignals.hasContributing) append.push("## Contributing\n\nIssues and pull requests are welcome. Please keep changes small and include tests or documentation updates when relevant.\n\n欢迎提交 issue 和 pull request。请保持修改小而清晰，并在需要时补充测试或文档。\n");
  if (!readmeSignals.hasRoadmap) append.push("## Roadmap\n\n- [ ] Document the first practical use case.\n- [ ] Add examples for common workflows.\n");
  if (!append.length && readmeSignals.hasBadge) return null;
  return `${content.trim()}\n\n<!-- RepoReady suggested sections -->\n\n${append.join("\n")}`;
}

function buildWorkflow(commands = {}) {
  const steps = [];
  if (commands.test) steps.push(`      - name: Test\n        run: ${commands.test}`);
  if (commands.build) steps.push(`      - name: Build\n        run: ${commands.build}`);
  const validationSteps = steps.length ? steps.join("\n") : `      - name: No project validation command detected\n        run: echo "RepoReady did not detect a test or build command."`;
  return `name: RepoReady

on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  repoready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${validationSteps}
      - name: RepoReady report
        if: always()
        run: npx repoready --markdown >> "$GITHUB_STEP_SUMMARY"
`;
}

function buildGitignore() {
  return `node_modules
dist
build
coverage
.next
.turbo
.cache
out
target
.env
.env.*
!.env.example
*.log
`;
}

function buildIssueTemplate() {
  return `---
name: Bug report
about: Report a reproducible problem
---

## Summary

## Steps to reproduce

## Expected behavior

## Environment
`;
}

function buildPrTemplate() {
  return `## Summary

## Checklist

- [ ] I kept the change focused and reviewable.
- [ ] I updated tests or documentation when relevant.
- [ ] I reviewed risky commands or generated files.
`;
}

export function renderReport(report, options = {}) {
  const lang = options.lang === "zh" ? "zh" : "en";
  if (options.format === "json") return JSON.stringify(report, null, 2);
  if (options.format === "markdown") return renderMarkdown(report, lang);
  return renderText(report, lang);
}

function renderText(report, lang) {
  const zh = lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const lines = [];
  lines.push(`RepoReady ${t("Report", "报告")}: ${report.repository.name}`);
  lines.push("=".repeat(lines[0].length));
  lines.push(`${t("Overall", "总分")}: ${report.scores.overall}/100`);
  lines.push(`- Agent Ready: ${report.scores.agentReady}/100 (confidence ${report.scores.confidence.agentReady})`);
  lines.push(`- Contributor Ready: ${report.scores.contributorReady}/100 (confidence ${report.scores.confidence.contributorReady})`);
  lines.push(`- Context Quality: ${report.scores.contextQuality}/100 (confidence ${report.scores.confidence.contextQuality})`);
  lines.push(`- Safety: ${report.scores.safety}/100 (confidence ${report.scores.confidence.safety})`);
  lines.push("");
  lines.push(t("Top issues", "主要问题"));
  for (const issue of report.issues.slice(0, 8)) lines.push(`- [${issue.severity}] ${zh ? issue.titleZh : issue.title}`);
  if (!report.issues.length) lines.push(`- ${t("No major issues detected.", "未发现主要问题。")}`);
  lines.push("");
  lines.push(t("Quick recommendations", "快速建议"));
  for (const rec of report.recommendations.slice(0, 6)) lines.push(`- ${zh ? rec.zh : rec.en}`);
  lines.push("");
  lines.push(t("Fix preview", "修复预览"));
  lines.push(`- ${report.fixes.count} ${t("file changes can be generated", "个文件修改可生成")}`);
  if (report.scoreComparison?.hasBaseline) {
    lines.push("");
    lines.push(t("Compared with baseline", "与基线对比"));
    lines.push(`- ${report.scoreComparison.summary[zh ? "zh" : "en"]}`);
  }
  return lines.join("\n");
}

function renderMarkdown(report, lang) {
  const zh = lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const rows = [
    ["Overall", report.scores.overall],
    ["Agent Ready", report.scores.agentReady],
    ["Contributor Ready", report.scores.contributorReady],
    ["Context Quality", report.scores.contextQuality],
    ["Safety", report.scores.safety]
  ];
  return `# RepoReady ${t("Report", "报告")}

**Repository:** ${report.repository.name}

| Score | Value |
| --- | ---: |
${rows.map(([k, v]) => `| ${k} | ${v}/100 |`).join("\n")}

| Confidence | Value |
| --- | ---: |
| Agent Ready | ${(report.scores.confidence.agentReady * 100).toFixed(0)}% |
| Contributor Ready | ${(report.scores.confidence.contributorReady * 100).toFixed(0)}% |
| Context Quality | ${(report.scores.confidence.contextQuality * 100).toFixed(0)}% |
| Safety | ${(report.scores.confidence.safety * 100).toFixed(0)}% |

## ${t("Top issues", "主要问题")}

${report.issues.slice(0, 10).map((i) => `- **${i.severity}**: ${zh ? i.titleZh : i.title}`).join("\n") || `- ${t("No major issues detected.", "未发现主要问题。")}`}

## ${t("Recommendations", "建议")}

${report.recommendations.slice(0, 10).map((r) => `- ${zh ? r.zh : r.en}`).join("\n") || `- ${t("No recommendations.", "暂无建议。")}`}

## ${t("Agent task suggestions", "Agent 任务建议")}

${report.taskSuggestions.map((s) => `- ${zh ? s.zh : s.en}`).join("\n")}

## Deep Analysis

${buildDeepAnalysisMarkdown(report, zh)}

## Baseline Comparison

${buildBaselineMarkdown(report, zh)}
`;
}

function buildDeepAnalysisMarkdown(report, zh) {
  const t = (en, cn) => (zh ? cn : en);
  const da = report.deepAnalysis;
  if (!da) return "";
  const lines = [];
  if (da.readmeQuality) {
    lines.push(`### README Quality: ${da.readmeQuality.grade} (${da.readmeQuality.score}/100)`);
    lines.push(`${da.readmeQuality.summary[zh ? "zh" : "en"]}`);
    lines.push(`Confidence: ${(report.scores.confidence.agentReady * 100).toFixed(0)}%`);
    lines.push("");
  }
  if (da.dependencyHealth) {
    lines.push(`### Dependencies: ${da.dependencyHealth.score}/100`);
    lines.push(`${da.dependencyHealth.summary[zh ? "zh" : "en"]}`);
    lines.push("");
  }
  if (da.safetyBoundaries) {
    lines.push(`### Safety Boundaries: ${da.safetyBoundaries.score}/100`);
    lines.push(`${da.safetyBoundaries.summary[zh ? "zh" : "en"]}`);
    for (const boundary of da.safetyBoundaries.boundaries.slice(0, 3)) {
      lines.push(`- ${zh ? boundary.zh : boundary.en}`);
    }
    lines.push("");
  }
  if (da.taskGraph) {
    lines.push(`### Task Graph: ${da.taskGraph.totalTasks} tasks`);
    lines.push(`${da.taskGraph.summary[zh ? "zh" : "en"]}`);
    for (const task of da.taskGraph.tasks.slice(0, 5)) {
      lines.push(`- [${task.priority}] ${zh ? task.zh : task.en}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildBaselineMarkdown(report, zh) {
  const b = report.scoreComparison;
  if (!b || !b.hasBaseline) {
    return zh ? "暂无基线对比。可先保存 `.repoready-baseline.json`。" : "No baseline comparison yet. Save a `.repoready-baseline.json` file first.";
  }
  const d = b.deltas;
  return [
    `- Overall: ${formatDelta(d.overall)}`,
    `- Agent Ready: ${formatDelta(d.agentReady)}`,
    `- Contributor Ready: ${formatDelta(d.contributorReady)}`,
    `- Context Quality: ${formatDelta(d.contextQuality)}`,
    `- Safety: ${formatDelta(d.safety)}`,
    "",
    zh ? `改善 ${b.improved} 项，退化 ${b.regressed} 项。` : `${b.improved} improved, ${b.regressed} regressed.`
  ].join("\n");
}

function compareToBaseline(scores, baseline) {
  if (!baseline) {
    return {
      hasBaseline: false,
      summary: {
        en: "No baseline found. Run RepoReady on a previous commit or save a baseline to enable comparisons.",
        zh: "未找到基线。请在之前的提交上运行 RepoReady 或保存基线以启用对比。"
      }
    };
  }

  const deltas = {
    overall: scores.overall - baseline.overall,
    agentReady: scores.agentReady - baseline.agentReady,
    contributorReady: scores.contributorReady - baseline.contributorReady,
    contextQuality: scores.contextQuality - baseline.contextQuality,
    safety: scores.safety - baseline.safety
  };

  return {
    hasBaseline: true,
    baseline,
    deltas,
    improved: Object.values(deltas).filter((d) => d > 0).length,
    regressed: Object.values(deltas).filter((d) => d < 0).length,
    summary: {
      en: `Compared with baseline: ${formatDelta(deltas.overall)} overall, ${formatDelta(deltas.agentReady)} agent, ${formatDelta(deltas.contributorReady)} contributor, ${formatDelta(deltas.contextQuality)} context, ${formatDelta(deltas.safety)} safety.`,
      zh: `相较基线：总分 ${formatDelta(deltas.overall)}，Agent ${formatDelta(deltas.agentReady)}，贡献者 ${formatDelta(deltas.contributorReady)}，上下文 ${formatDelta(deltas.contextQuality)}，安全 ${formatDelta(deltas.safety)}。`
    }
  };
}

function formatDelta(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

async function loadBaseline(cwd) {
  try {
    const file = path.join(cwd, ".repoready-baseline.json");
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function buildUnifiedDiff(changes) {
  return changes.map((change) => {
    const header = `diff --git a/${change.path} b/${change.path}\n--- a/${change.path}\n+++ b/${change.path}\n`;
    const body = change.content.split("\n").map((line) => `+${line}`).join("\n");
    return `${header}${body}`;
  }).join("\n\n");
}

export async function writeFixes(cwd, changes, options = {}) {
  const root = path.resolve(cwd);
  const written = [];
  for (const change of changes) {
    const target = path.resolve(root, change.path);
    if (!target.startsWith(root)) throw new Error(`Refusing to write outside repository: ${change.path}`);
    const exists = fssync.existsSync(target);
    if (exists && change.action === "create" && !options.overwrite) continue;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, change.content, "utf8");
    written.push(change.path);
  }
  return written;
}

export function matchTemplates(stack) {
  const matched = [];
  if (stack.frameworks.includes("Next.js") || stack.frameworks.includes("React")) matched.push("next.js");
  if (stack.frameworks.includes("Vue")) matched.push("vue");
  if (stack.languages.includes("Python")) matched.push("python");
  if (stack.languages.includes("Rust")) matched.push("rust");
  if (stack.languages.includes("Go")) matched.push("go");
  if (stack.frameworks.includes("monorepo/workspace")) matched.push("monorepo/workspace");
  return matched;
}

export function getAgentTemplate(key) {
  return AGENT_TEMPLATES[key] || null;
}

export function listAgentTemplates() {
  return Object.entries(AGENT_TEMPLATES).map(([key, value]) => ({ key, name: value.name }));
}

export function generateFixesWithTemplate(report, templateKey) {
  const template = AGENT_TEMPLATES[templateKey];
  if (!template) return report.fixes;
  const changes = report.fixes.changes.map((change) => {
    if (change.path === "AGENTS.md" && template.agentsMd) return { ...change, content: template.agentsMd };
    if (change.path === "CLAUDE.md" && template.claudeMd) return { ...change, content: template.claudeMd };
    return change;
  });
  if (!report.fixes.changes.some((c) => c.path === "CLAUDE.md") && template.claudeMd) {
    changes.push({ path: "CLAUDE.md", action: "create", content: template.claudeMd });
  }
  if (template.cursorRules) {
    changes.push({ path: ".cursor/rules", action: "create", content: template.cursorRules });
  }
  return { changes, count: changes.length };
}
import { analyzeReadmeQuality } from "./analyze-readme.js";
import { analyzeDependencyHealth } from "./analyze-dependencies.js";
import { analyzeSafetyBoundaries } from "./analyze-safety.js";
import { analyzeTaskGraph } from "./analyze-tasks.js";
import { isAiAvailable, getAiConfig, enhanceReadmeQuality, enhanceTaskGraph, enhanceAgentsMd, estimateTokens, estimateCost } from "./ai-enhancer.js";
import { loadStrategy, evaluateStrategy, executeStrategyPlan, renderStrategyReport, loadUserPolicy } from "./ai-strategy.js";
async function applyAiEnhancements(deepAnalysis, stack, commands, fixes, options, cwd) {
  if (!isAiAvailable()) return null;
  if (options.ai === false) return null;
  const config = getAiConfig();
  if (!config) return null;

  const userPolicy = await loadUserPolicy(cwd);
  const strategy = loadStrategy(userPolicy?.ai);
  const evaluation = evaluateStrategy(deepAnalysis, fixes, strategy);

  if (!evaluation.plan.length) {
    return { strategyReport: renderStrategyReport(evaluation), enhancements: null };
  }

  try {
    const enhancerFunctions = {
      readme: async (da) => {
        const enhanced = await enhanceReadmeQuality(da.readmeQuality, config);
        if (!enhanced) return null;
        try { return JSON.parse(enhanced); } catch { return enhanced; }
      },
      tasks: async (da) => {
        const enhanced = await enhanceTaskGraph(da.taskGraph, stack, config);
        if (!enhanced) return null;
        try { return JSON.parse(enhanced); } catch { return enhanced; }
      },
      agentsMd: async (da, f) => {
        const change = f.changes.find((c) => c.path === "AGENTS.md");
        if (!change) return null;
        return enhanceAgentsMd(change.content, stack, commands, config);
      },
      safety: async () => null,
      dependencies: async () => null
    };

    const execution = await executeStrategyPlan(evaluation.plan, deepAnalysis, fixes, stack, commands, enhancerFunctions);

    return {
      strategyReport: renderStrategyReport(evaluation),
      strategyDetails: evaluation,
      enhancements: execution.results,
      executionSummary: execution.summary,
      executed: execution.executed,
      failed: execution.failed
    };
  } catch (error) {
    return {
      strategyReport: renderStrategyReport(evaluation),
      error: error.message
    };
  }
}
