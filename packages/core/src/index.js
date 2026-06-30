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

export const VERSION = "0.4.0";

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
  const codeQuality = analyzeCodeQuality({ commands, fileSet, repoHealth, manifests });
  const scoreBreakdown = buildScoreBreakdown({ agentFiles, commands, contextNoise, readmeSignals, repoHealth, dangerousScripts, codeQuality });
  const scores = calculateScores({ agentFiles, commands, dangerousScripts, contextNoise, readmeSignals, fileSet, repoHealth, codeQuality });
  const evidence = buildEvidence({ agentFiles, commands, readmeSignals, repoHealth, contextNoise, dangerousScripts, codeQuality });
  const recommendations = buildRecommendations(issues);
  const taskSuggestions = buildTaskSuggestions({ stack, commands, issues });
  const fixes = generateFixes({ stack, commands, readme, readmeSignals, agentFiles, fileSet, scores, repoHealth });
  const agentFailureRisk = buildAgentFailureRisk({ agentFiles, commands, readmeSignals, repoHealth, contextNoise, dangerousScripts });

  const templates = matchTemplates(stack);

  const deepAnalysis = {
    readmeQuality: analyzeReadmeQuality(readme?.content || ""),
    dependencyHealth: analyzeDependencyHealth(manifests, fileSet),
    safetyBoundaries: analyzeSafetyBoundaries(fileSet, dangerousScripts, repoHealth),
    taskGraph: analyzeTaskGraph(stack, commands, fileSet, readmeSignals, agentFiles, issues)
  };
  const strategy = buildRepositoryStrategy({ scores, issues, recommendations, fixes, evidence, deepAnalysis, commands, agentFiles, repoHealth, contextNoise, dangerousScripts, agentFailureRisk });

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
    evidence,
    scoreBreakdown,
    codeQuality,
    issues,
    recommendations,
    taskSuggestions,
    fixes
    ,
    agentFailureRisk
    ,
    templates
    ,
    deepAnalysis
    ,
    strategy
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
  if (fileSet.has("tsconfig.json")) manifests.tsconfig = await readJson(path.join(cwd, "tsconfig.json"));
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
    typecheck: scripts.typecheck || scripts["type-check"] || scripts.check || null,
    format: scripts.format || scripts["format:check"] || null,
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

function analyzeCodeQuality({ commands, fileSet, repoHealth, manifests }) {
  const deps = { ...(manifests.packageJson?.dependencies || {}), ...(manifests.packageJson?.devDependencies || {}) };
  const hasTestFiles = [...fileSet].some((file) => /(^|\/)(__tests__|tests?|spec)\//i.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(file));
  const hasStrictTs = Boolean(manifests.tsconfig?.compilerOptions?.strict);
  const hasLintConfig = Boolean(commands.lint || deps.eslint || deps["@biomejs/biome"] || fileSet.has("eslint.config.js") || fileSet.has(".eslintrc") || fileSet.has("biome.json"));
  const hasFormatConfig = Boolean(commands.format || deps.prettier || deps["@biomejs/biome"] || fileSet.has(".prettierrc") || fileSet.has("biome.json"));
  const hasLockfile = fileSet.has("pnpm-lock.yaml") || fileSet.has("package-lock.json") || fileSet.has("yarn.lock") || fileSet.has("bun.lockb") || fileSet.has("cargo.lock") || fileSet.has("go.sum") || fileSet.has("poetry.lock");
  const items = [
    { id: "test-command", label: "Test command", labelZh: "测试命令", passed: Boolean(commands.test), points: 25, detail: commands.test || "missing" },
    { id: "lint-command", label: "Lint command", labelZh: "Lint 命令", passed: hasLintConfig, points: 15, detail: hasLintConfig ? (commands.lint || "lint tooling detected") : "missing" },
    { id: "typecheck-command", label: "Typecheck command", labelZh: "类型/检查命令", passed: Boolean(commands.typecheck) || hasStrictTs, points: 15, detail: commands.typecheck || (hasStrictTs ? "TypeScript strict mode" : "missing") },
    { id: "format-command", label: "Format command", labelZh: "格式化命令", passed: hasFormatConfig, points: 10, detail: hasFormatConfig ? (commands.format || "format tooling detected") : "missing" },
    { id: "ci", label: "CI workflow", labelZh: "CI 工作流", passed: repoHealth.hasCi, points: 15, detail: repoHealth.workflows?.[0] || "missing" },
    { id: "test-files", label: "Test files", labelZh: "测试文件", passed: hasTestFiles, points: 10, detail: hasTestFiles ? "test files detected" : "missing" },
    { id: "lockfile", label: "Dependency lockfile", labelZh: "依赖锁文件", passed: hasLockfile, points: 10, detail: hasLockfile ? "lockfile detected" : "missing" }
  ];
  return {
    score: items.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0),
    items,
    hasTestFiles,
    hasStrictTs,
    hasLintConfig,
    hasFormatConfig,
    hasLockfile
  };
}

function buildEvidence({ agentFiles, commands, readmeSignals, repoHealth, contextNoise, dangerousScripts, codeQuality }) {
  const item = ({ id, status, severity = "low", category, title, titleZh, source = "heuristic", detail = "", impact, impactZh, fixability = "review", suggestedFix = "", suggestedFixZh = "" }) => ({ id, status, severity, category, title, titleZh, source, detail, impact, impactZh, fixability, suggestedFix, suggestedFixZh });
  const pass = (id, category, title, titleZh, source, detail = "", impact = "This signal helps agents understand and validate the repository.", impactZh = "\u8be5\u4fe1\u53f7\u6709\u52a9\u4e8e agent \u7406\u89e3\u548c\u9a8c\u8bc1\u4ed3\u5e93\u3002") => item({ id, status: "pass", severity: "low", category, title, titleZh, source, detail, impact, impactZh, fixability: "none" });
  const fail = (id, category, severity, title, titleZh, source, detail, impact, impactZh, fixability, suggestedFix, suggestedFixZh) => item({ id, status: "fail", severity, category, title, titleZh, source, detail, impact, impactZh, fixability, suggestedFix, suggestedFixZh });
  return [
    agentFiles.any
      ? pass("agent-instructions", "agent", "Agent instructions detected", "\u5df2\u68c0\u6d4b\u5230 Agent \u534f\u4f5c\u8bf4\u660e", "file-tree", [agentFiles.agentsMd ? "AGENTS.md" : null, agentFiles.claudeMd ? "CLAUDE.md" : null, agentFiles.cursorRules ? ".cursor/rules" : null].filter(Boolean).join(", "), "Agents have explicit project instructions instead of guessing structure and rules.", "Agent \u6709\u660e\u786e\u7684\u9879\u76ee\u7ed3\u6784\u3001\u547d\u4ee4\u548c\u89c4\u5219\uff0c\u4e0d\u5fc5\u731c\u6d4b\u3002")
      : fail("agent-instructions", "agent", "high", "Agent instructions missing", "\u7f3a\u5c11 Agent \u534f\u4f5c\u8bf4\u660e", "file-tree", "AGENTS.md / CLAUDE.md / .cursor/rules not found", "Agents may drift in scope or modify the wrong files without explicit repository instructions.", "\u7f3a\u5c11\u660e\u786e\u8bf4\u660e\u65f6\uff0cagent \u5bb9\u6613\u6269\u5927\u8303\u56f4\u6216\u4fee\u6539\u9519\u8bef\u6587\u4ef6\u3002", "safe", "Add AGENTS.md with structure, commands, rules, and safety boundaries.", "\u6dfb\u52a0 AGENTS.md\uff0c\u8bf4\u660e\u7ed3\u6784\u3001\u547d\u4ee4\u3001\u89c4\u5219\u548c\u5b89\u5168\u8fb9\u754c\u3002"),
    commands.test
      ? pass("test-command", "validation", "Test command detected", "\u5df2\u68c0\u6d4b\u5230\u6d4b\u8bd5\u547d\u4ee4", "package.json", commands.test, "Agents can validate code changes after editing.", "Agent \u4fee\u6539\u4ee3\u7801\u540e\u53ef\u4ee5\u9a8c\u8bc1\u7ed3\u679c\u3002")
      : fail("test-command", "validation", "high", "Test command missing", "\u7f3a\u5c11\u6d4b\u8bd5\u547d\u4ee4", "package.json", "No test script or documented test command detected", "Agents cannot reliably validate changes, increasing regression risk.", "Agent \u65e0\u6cd5\u53ef\u9760\u9a8c\u8bc1\u4fee\u6539\uff0c\u56de\u5f52\u98ce\u9669\u5347\u9ad8\u3002", "review", "Document or add a test command.", "\u8865\u5145\u6216\u8bf4\u660e\u6d4b\u8bd5\u547d\u4ee4\u3002"),
    commands.build
      ? pass("build-command", "validation", "Build command detected", "\u5df2\u68c0\u6d4b\u5230\u6784\u5efa\u547d\u4ee4", "package.json", commands.build, "Production readiness can be checked before merge.", "\u5408\u5e76\u524d\u53ef\u4ee5\u68c0\u67e5\u751f\u4ea7\u6784\u5efa\u53ef\u7528\u6027\u3002")
      : fail("build-command", "validation", "medium", "Build command missing", "\u7f3a\u5c11\u6784\u5efa\u547d\u4ee4", "package.json", "No build command detected", "Agents cannot confirm production build readiness.", "Agent \u65e0\u6cd5\u786e\u8ba4\u751f\u4ea7\u6784\u5efa\u662f\u5426\u53ef\u7528\u3002", "review", "Document or add a build command.", "\u8865\u5145\u6216\u8bf4\u660e\u6784\u5efa\u547d\u4ee4\u3002"),
    repoHealth.hasCi
      ? pass("ci-workflow", "validation", "GitHub Actions workflow detected", "\u5df2\u68c0\u6d4b\u5230 GitHub Actions \u5de5\u4f5c\u6d41", ".github/workflows/*", repoHealth.workflows?.[0] || "", "Pull requests can be validated consistently.", "PR \u53ef\u4ee5\u83b7\u5f97\u7a33\u5b9a\u4e00\u81f4\u7684\u81ea\u52a8\u9a8c\u8bc1\u3002")
      : fail("ci-workflow", "validation", "medium", "GitHub Actions workflow missing", "\u7f3a\u5c11 GitHub Actions \u5de5\u4f5c\u6d41", ".github/workflows/*", "No workflow file detected", "Agent-authored changes are harder to review without CI feedback.", "\u6ca1\u6709 CI \u53cd\u9988\u65f6\uff0cagent \u751f\u6210\u7684\u4fee\u6539\u66f4\u96be\u5ba1\u67e5\u3002", "review", "Add a minimal CI workflow.", "\u6dfb\u52a0\u6700\u5c0f\u53ef\u7528\u7684 CI \u5de5\u4f5c\u6d41\u3002"),
    readmeSignals.exists
      ? pass("readme", "onboarding", "README detected", "\u5df2\u68c0\u6d4b\u5230 README", "README.md", [readmeSignals.hasInstall ? "install" : null, readmeSignals.hasUsage ? "usage" : null, readmeSignals.hasTest ? "test" : null, readmeSignals.hasContributing ? "contributing" : null].filter(Boolean).join(", "), "Humans and agents have an onboarding entry point.", "\u65b0\u4eba\u548c agent \u90fd\u6709\u9879\u76ee\u5165\u53e3\u8bf4\u660e\u3002")
      : fail("readme", "onboarding", "high", "README missing", "\u7f3a\u5c11 README", "README.md", "README not found or empty", "Agents and contributors must infer install, usage, and contribution paths.", "Agent \u548c\u8d21\u732e\u8005\u5fc5\u987b\u731c\u6d4b\u5b89\u88c5\u3001\u4f7f\u7528\u548c\u8d21\u732e\u65b9\u5f0f\u3002", "review", "Add README with install, usage, test, and contribution sections.", "\u6dfb\u52a0\u5305\u542b\u5b89\u88c5\u3001\u4f7f\u7528\u3001\u6d4b\u8bd5\u548c\u8d21\u732e\u8bf4\u660e\u7684 README\u3002"),
    dangerousScripts.length === 0
      ? pass("safe-scripts", "safety", "No dangerous scripts detected", "\u672a\u53d1\u73b0\u5371\u9669\u811a\u672c", "package.json", "", "No obvious destructive scripts were detected statically.", "\u9759\u6001\u626b\u63cf\u672a\u53d1\u73b0\u660e\u663e\u7834\u574f\u6027\u811a\u672c\u3002")
      : fail("safe-scripts", "safety", "critical", "Dangerous scripts detected", "\u53d1\u73b0\u5371\u9669\u811a\u672c", "package.json", dangerousScripts.map((s) => s.name).join(", "), "Agents may accidentally run destructive, deployment, database, or force-push commands.", "Agent \u53ef\u80fd\u8bef\u89e6\u7834\u574f\u6027\u3001\u90e8\u7f72\u3001\u6570\u636e\u5e93\u6216\u5f3a\u5236\u63a8\u9001\u547d\u4ee4\u3002", "manual", "Review dangerous scripts manually and mark them human-approval-only.", "\u4eba\u5de5\u5ba1\u67e5\u5371\u9669\u811a\u672c\uff0c\u5e76\u6807\u8bb0\u4e3a\u4ec5\u5141\u8bb8\u4eba\u5de5\u6279\u51c6\u540e\u6267\u884c\u3002"),
    contextNoise.generatedFilesTracked.length === 0 && contextNoise.largeFiles.length === 0
      ? pass("clean-context", "context", "Repository context is clean", "\u4ed3\u5e93\u4e0a\u4e0b\u6587\u8f83\u5e72\u51c0", "file-tree", "", "Agent context is less likely to be polluted by generated files or large artifacts.", "Agent \u4e0a\u4e0b\u6587\u4e0d\u5bb9\u6613\u88ab\u751f\u6210\u7269\u6216\u5927\u6587\u4ef6\u6c61\u67d3\u3002")
      : fail("clean-context", "context", "medium", "Context noise detected", "\u53d1\u73b0\u4e0a\u4e0b\u6587\u566a\u97f3", "file-tree", `${contextNoise.generatedFilesTracked.length} generated/cache, ${contextNoise.largeFiles.length} large files`, "Agents may waste context on generated files, caches, or large artifacts.", "Agent \u53ef\u80fd\u628a\u4e0a\u4e0b\u6587\u6d6a\u8d39\u5728\u751f\u6210\u7269\u3001\u7f13\u5b58\u6216\u5927\u6587\u4ef6\u4e0a\u3002", "review", "Update .gitignore and remove unnecessary generated artifacts.", "\u66f4\u65b0 .gitignore\uff0c\u5e76\u79fb\u9664\u4e0d\u5fc5\u8981\u7684\u751f\u6210\u7269\u3002"),
    codeQuality.score >= 70
      ? pass("code-quality", "quality", "Code quality signals are strong", "\u4ee3\u7801\u8d28\u91cf\u4fe1\u53f7\u8f83\u5f3a", "heuristic", `${codeQuality.score}/100`, "Quality signals make agent changes easier to validate and review.", "\u8d28\u91cf\u4fe1\u53f7\u8ba9 agent \u4fee\u6539\u66f4\u5bb9\u6613\u9a8c\u8bc1\u548c\u5ba1\u67e5\u3002")
      : fail("code-quality", "quality", "medium", "Code quality signals are weak", "\u4ee3\u7801\u8d28\u91cf\u4fe1\u53f7\u8f83\u5f31", "heuristic", `${codeQuality.score}/100`, "Weak quality signals reduce confidence in agent-authored changes.", "\u8d28\u91cf\u4fe1\u53f7\u4e0d\u8db3\u4f1a\u964d\u4f4e\u5bf9 agent \u4fee\u6539\u7684\u4fe1\u5fc3\u3002", "review", "Add or document lint/check/test signals.", "\u8865\u5145\u6216\u8bf4\u660e lint/check/test \u4fe1\u53f7\u3002")
  ];
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

function buildAgentFailureRisk({ agentFiles, commands, readmeSignals, repoHealth, contextNoise, dangerousScripts }) {
  const risk = ({ id, score, title, titleZh, whyAgentsFail, whyAgentsFailZh, evidence, mitigation, mitigationZh, fixability }) => ({
    id,
    level: levelFromRiskScore(score),
    score: Math.max(0, Math.min(100, Math.round(score))),
    title,
    titleZh,
    whyAgentsFail,
    whyAgentsFailZh,
    evidence,
    mitigation,
    mitigationZh,
    fixability
  });
  const contextScore = Math.min(100, (contextNoise.generatedFilesTracked.length ? 34 : 0) + (contextNoise.largeFiles.length ? 34 : 0) + (!repoHealth.hasGitignore ? 32 : 0));
  const validationScore = Math.min(100, (!commands.test ? 45 : 0) + (!commands.build ? 25 : 0) + (!commands.lint && !commands.typecheck ? 20 : 0) + (!repoHealth.hasCi ? 10 : 0));
  const safetyScore = Math.min(100, (dangerousScripts.length ? 70 : 0) + ((repoHealth.envFiles || []).length ? 60 : 0));
  const onboardingScore = readmeSignals.exists ? Math.min(100, (!readmeSignals.hasInstall ? 22 : 0) + (!readmeSignals.hasUsage ? 22 : 0) + (!readmeSignals.hasTest ? 22 : 0) + (!readmeSignals.hasContributing ? 18 : 0) + (!readmeSignals.hasDemo ? 10 : 0)) : 88;
  const scopeScore = Math.min(100, (!agentFiles.any ? 78 : 0) + (!agentFiles.agentsMd ? 14 : 0));
  const risks = [
    risk({ id: "context_confusion", score: contextScore, title: "Context Confusion Risk", titleZh: "\u4e0a\u4e0b\u6587\u6df7\u6dc6\u98ce\u9669", whyAgentsFail: "Agents may waste context on generated files, caches, or large artifacts and choose the wrong files to edit.", whyAgentsFailZh: "Agent \u53ef\u80fd\u628a\u4e0a\u4e0b\u6587\u6d6a\u8d39\u5728\u751f\u6210\u7269\u3001\u7f13\u5b58\u6216\u5927\u6587\u4ef6\u4e0a\uff0c\u5e76\u56e0\u6b64\u9009\u9519\u8981\u4fee\u6539\u7684\u6587\u4ef6\u3002", evidence: [{ source: "file-tree", detail: `${contextNoise.generatedFilesTracked.length} generated/cache files tracked` }, { source: "file-tree", detail: `${contextNoise.largeFiles.length} large files detected` }, { source: ".gitignore", detail: repoHealth.hasGitignore ? ".gitignore detected" : ".gitignore missing" }], mitigation: "Keep generated files, caches, and large artifacts out of repository context.", mitigationZh: "\u628a\u751f\u6210\u7269\u3001\u7f13\u5b58\u548c\u5927\u6587\u4ef6\u6392\u9664\u5728\u4ed3\u5e93\u4e0a\u4e0b\u6587\u4e4b\u5916\u3002", fixability: contextScore >= 60 ? "review" : "safe" }),
    risk({ id: "validation_gap", score: validationScore, title: "Validation Gap", titleZh: "\u9a8c\u8bc1\u7f3a\u53e3", whyAgentsFail: "Agents can change code but cannot reliably prove the change works without test, build, lint, or CI signals.", whyAgentsFailZh: "\u7f3a\u5c11\u6d4b\u8bd5\u3001\u6784\u5efa\u3001lint \u6216 CI \u4fe1\u53f7\u65f6\uff0cAgent \u5373\u4f7f\u5b8c\u6210\u4fee\u6539\u4e5f\u65e0\u6cd5\u53ef\u9760\u8bc1\u660e\u4fee\u6539\u6709\u6548\u3002", evidence: [{ source: "package.json", detail: commands.test ? `test: ${commands.test}` : "test command missing" }, { source: "package.json", detail: commands.build ? `build: ${commands.build}` : "build command missing" }, { source: ".github/workflows/*", detail: repoHealth.hasCi ? "CI detected" : "CI missing" }], mitigation: "Document or add validation commands and run them in CI.", mitigationZh: "\u8865\u5145\u9a8c\u8bc1\u547d\u4ee4\uff0c\u5e76\u5c3d\u91cf\u5728 CI \u4e2d\u8fd0\u884c\u3002", fixability: "review" }),
    risk({ id: "safety_boundary", score: safetyScore, title: "Safety Boundary Risk", titleZh: "\u5b89\u5168\u8fb9\u754c\u98ce\u9669", whyAgentsFail: "Agents may accidentally run destructive, deployment, database, secret, or force-push commands without an explicit boundary.", whyAgentsFailZh: "\u6ca1\u6709\u660e\u786e\u8fb9\u754c\u65f6\uff0cAgent \u53ef\u80fd\u8bef\u89e6\u7834\u574f\u6027\u3001\u90e8\u7f72\u3001\u6570\u636e\u5e93\u3001\u5bc6\u94a5\u6216\u5f3a\u5236\u63a8\u9001\u76f8\u5173\u547d\u4ee4\u3002", evidence: [{ source: "package.json", detail: dangerousScripts.length ? dangerousScripts.map((s) => `${s.name}: ${s.label}`).join(", ") : "no dangerous scripts detected" }, { source: "file-tree", detail: (repoHealth.envFiles || []).length ? `${repoHealth.envFiles.length} env files committed` : "no committed env files detected" }], mitigation: "Mark risky commands as human-approval-only and keep secrets out of source control.", mitigationZh: "\u628a\u9ad8\u98ce\u9669\u547d\u4ee4\u6807\u8bb0\u4e3a\u4ec5\u4eba\u5de5\u6279\u51c6\u540e\u6267\u884c\uff0c\u5e76\u907f\u514d\u628a\u5bc6\u94a5\u63d0\u4ea4\u5230\u6e90\u7801\u3002", fixability: safetyScore ? "manual" : "safe" }),
    risk({ id: "onboarding_gap", score: onboardingScore, title: "Onboarding Gap", titleZh: "\u4e0a\u624b\u8bf4\u660e\u7f3a\u53e3", whyAgentsFail: "Agents and contributors need to infer installation, usage, testing, and contribution paths from scattered context.", whyAgentsFailZh: "Agent \u548c\u8d21\u732e\u8005\u9700\u8981\u4ece\u96f6\u6563\u4e0a\u4e0b\u6587\u4e2d\u731c\u6d4b\u5b89\u88c5\u3001\u4f7f\u7528\u3001\u6d4b\u8bd5\u548c\u8d21\u732e\u8def\u5f84\u3002", evidence: [{ source: "README.md", detail: readmeSignals.exists ? "README detected" : "README missing" }, { source: "README.md", detail: `install=${readmeSignals.hasInstall}, usage=${readmeSignals.hasUsage}, test=${readmeSignals.hasTest}, contributing=${readmeSignals.hasContributing}` }], mitigation: "Add concise install, usage, testing, and contribution sections.", mitigationZh: "\u8865\u5145\u7b80\u6d01\u7684\u5b89\u88c5\u3001\u4f7f\u7528\u3001\u6d4b\u8bd5\u548c\u8d21\u732e\u8bf4\u660e\u3002", fixability: "review" }),
    risk({ id: "scope_drift", score: scopeScore, title: "Scope Drift Risk", titleZh: "\u8303\u56f4\u6f02\u79fb\u98ce\u9669", whyAgentsFail: "Without agent instructions, agents may expand the task, edit unrelated files, or miss project-specific conventions.", whyAgentsFailZh: "\u7f3a\u5c11 agent \u6307\u4ee4\u65f6\uff0cAgent \u5bb9\u6613\u6269\u5927\u4efb\u52a1\u8303\u56f4\u3001\u4fee\u6539\u65e0\u5173\u6587\u4ef6\uff0c\u6216\u5ffd\u7565\u9879\u76ee\u7279\u5b9a\u89c4\u8303\u3002", evidence: [{ source: "file-tree", detail: agentFiles.agentsMd ? "AGENTS.md detected" : "AGENTS.md missing" }, { source: "file-tree", detail: agentFiles.claudeMd ? "CLAUDE.md detected" : "CLAUDE.md missing" }, { source: "file-tree", detail: agentFiles.cursorRules ? ".cursor/rules detected" : ".cursor/rules missing" }], mitigation: "Add AGENTS.md with file scope, commands, coding rules, and safety boundaries.", mitigationZh: "\u6dfb\u52a0 AGENTS.md\uff0c\u8bf4\u660e\u6587\u4ef6\u8303\u56f4\u3001\u547d\u4ee4\u3001\u7f16\u7801\u89c4\u5219\u548c\u5b89\u5168\u8fb9\u754c\u3002", fixability: "safe" })
  ];
  const sorted = [...risks].sort((a, b) => b.score - a.score);
  const topRisks = sorted.filter((item) => item.score > 0).slice(0, 3);
  const overallLevel = topRisks[0]?.level || "low";
  return {
    overallLevel,
    topRisks,
    risks,
    summary: topRisks.length ? `Top agent failure risk: ${topRisks[0].title}. ${topRisks[0].mitigation}` : "No major agent failure risks detected. Keep policy and validation signals current.",
    summaryZh: topRisks.length ? `\u6700\u4e3b\u8981\u7684 agent \u5931\u8d25\u98ce\u9669\uff1a${topRisks[0].titleZh}\u3002${topRisks[0].mitigationZh}` : "\u672a\u53d1\u73b0\u4e3b\u8981 agent \u5931\u8d25\u98ce\u9669\u3002\u8bf7\u6301\u7eed\u7ef4\u62a4\u7b56\u7565\u548c\u9a8c\u8bc1\u4fe1\u53f7\u3002"
  };
}

function levelFromRiskScore(score) {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function buildRepositoryStrategy(input) {
  const { scores, issues, fixes, evidence, deepAnalysis, commands, agentFiles, repoHealth, contextNoise, dangerousScripts, agentFailureRisk } = input;
  const fixPlan = buildFixPlan({ fixes, dangerousScripts, repoHealth, contextNoise });
  const highIssues = issues.filter((issue) => issue.severity === "high").length;
  const mediumIssues = issues.filter((issue) => issue.severity === "medium").length;
  const posture = scores.overall >= 90 ? "scale" : scores.overall >= 75 ? "polish" : scores.overall >= 55 ? "stabilize" : "recover";
  const summaryByPosture = {
    scale: { en: "This repository already has strong agent-readiness signals. The highest-leverage move is to make that readiness visible with badges, public reports, and a repeatable policy gate.", zh: "\u8be5\u4ed3\u5e93\u5df2\u7ecf\u5177\u5907\u8f83\u5f3a\u7684 AI agent \u9002\u914d\u4fe1\u53f7\u3002\u6700\u9ad8\u6760\u6746\u52a8\u4f5c\u662f\u7528 badge\u3001\u516c\u5f00\u62a5\u544a\u548c\u7b56\u7565\u95e8\u7981\u628a\u8fd9\u79cd\u80fd\u529b\u5c55\u793a\u51fa\u6765\u3002" },
    polish: { en: "This repository is usable for AI agents, but a few missing signals still force agents or contributors to guess. Focus on quick fixes and documentation precision.", zh: "\u8be5\u4ed3\u5e93\u5df2\u7ecf\u53ef\u4ee5\u88ab AI agent \u4f7f\u7528\uff0c\u4f46\u4ecd\u6709\u5c11\u91cf\u7f3a\u5931\u4fe1\u53f7\u4f1a\u8feb\u4f7f agent \u6216\u8d21\u732e\u8005\u731c\u6d4b\u3002\u4f18\u5148\u505a\u5feb\u901f\u4fee\u590d\u548c\u6587\u6863\u7cbe\u4fee\u3002" },
    stabilize: { en: "This repository needs a readiness pass before serious agent-driven work. Prioritize validation commands, agent instructions, and safety boundaries before growth tactics.", zh: "\u8be5\u4ed3\u5e93\u5728\u8fdb\u884c\u4e25\u8083\u7684 agent \u9a71\u52a8\u5f00\u53d1\u524d\uff0c\u9700\u8981\u5148\u5b8c\u6210\u9002\u914d\u52a0\u56fa\u3002\u4f18\u5148\u8865\u9f50\u9a8c\u8bc1\u547d\u4ee4\u3001agent \u6307\u4ee4\u548c\u5b89\u5168\u8fb9\u754c\u3002" },
    recover: { en: "This repository is not yet safe or clear enough for autonomous agent work. Start with minimal instructions, tests, and manual review boundaries.", zh: "\u8be5\u4ed3\u5e93\u76ee\u524d\u8fd8\u4e0d\u591f\u6e05\u6670\u6216\u5b89\u5168\uff0c\u4e0d\u9002\u5408\u81ea\u4e3b agent \u5de5\u4f5c\u3002\u8bf7\u5148\u5efa\u7acb\u6700\u5c0f\u8bf4\u660e\u3001\u6d4b\u8bd5\u548c\u4eba\u5de5\u5ba1\u67e5\u8fb9\u754c\u3002" }
  };
  const priorityActions = [];
  const addAction = (id, impact, effort, en, zh, command = "") => priorityActions.push({ id, impact, effort, en, zh, command });
  if (!agentFiles.any) addAction("agent-instructions", "high", "low", "Add AGENTS.md so coding agents know project structure, commands, rules, and safety boundaries.", "\u6dfb\u52a0 AGENTS.md\uff0c\u8ba9 coding agent \u7406\u89e3\u9879\u76ee\u7ed3\u6784\u3001\u547d\u4ee4\u3001\u89c4\u5219\u548c\u5b89\u5168\u8fb9\u754c\u3002", "npx @shidesheng0218/repo-ready@latest fix --only agents --dry-run");
  if (!commands.test) addAction("test-command", "high", "medium", "Document or add a test command before asking agents to modify code.", "\u5728\u8ba9 agent \u4fee\u6539\u4ee3\u7801\u524d\uff0c\u5148\u8865\u5145\u6216\u8bf4\u660e\u6d4b\u8bd5\u547d\u4ee4\u3002");
  if (!repoHealth.hasCi) addAction("ci", "medium", "medium", "Add a minimal CI workflow so human and agent changes are verifiable in pull requests.", "\u6dfb\u52a0\u6700\u5c0f CI \u5de5\u4f5c\u6d41\uff0c\u8ba9\u4eba\u548c agent \u7684\u4fee\u6539\u90fd\u80fd\u5728 PR \u4e2d\u9a8c\u8bc1\u3002");
  if (dangerousScripts.length) addAction("safety-boundary", "high", "medium", "Review dangerous scripts and mark them as human-approval-only in AGENTS.md.", "\u5ba1\u67e5\u5371\u9669\u811a\u672c\uff0c\u5e76\u5728 AGENTS.md \u4e2d\u6807\u8bb0\u4e3a\u4ec5\u4eba\u5de5\u6279\u51c6\u540e\u6267\u884c\u3002");
  if (contextNoise.generatedFilesTracked.length || contextNoise.largeFiles.length) addAction("context-cleanup", "medium", "medium", "Reduce generated files and large artifacts so agent context stays focused.", "\u51cf\u5c11\u751f\u6210\u7269\u548c\u5927\u6587\u4ef6\uff0c\u8ba9 agent \u4e0a\u4e0b\u6587\u4fdd\u6301\u805a\u7126\u3002");
  if (!priorityActions.length) addAction("growth", "medium", "low", "Publish the RepoReady badge and public report to make readiness visible.", "\u53d1\u5e03 RepoReady badge \u548c\u516c\u5f00\u62a5\u544a\uff0c\u8ba9\u4ed3\u5e93\u9002\u914d\u5ea6\u53ef\u89c1\u3002");
  const automationBoundary = [
    { level: "safe", en: "Create or update agent instruction files, templates, .env.example, and badges.", zh: "\u521b\u5efa\u6216\u66f4\u65b0 agent \u6307\u4ee4\u6587\u4ef6\u3001\u6a21\u677f\u3001.env.example \u548c badge\u3002" },
    { level: "review", en: "README, CI, package scripts, and workflow changes should be reviewed before merge.", zh: "README\u3001CI\u3001package scripts \u548c workflow \u4fee\u6539\u5e94\u5728\u5408\u5e76\u524d\u5ba1\u67e5\u3002" },
    { level: "manual", en: "Database, auth, payment, deployment, secrets, and destructive scripts require explicit human approval.", zh: "\u6570\u636e\u5e93\u3001\u8ba4\u8bc1\u3001\u652f\u4ed8\u3001\u90e8\u7f72\u3001\u5bc6\u94a5\u548c\u7834\u574f\u6027\u811a\u672c\u5fc5\u987b\u83b7\u5f97\u660e\u786e\u4eba\u5de5\u6279\u51c6\u3002" }
  ];
  const now = priorityActions.slice(0, 2).map((item) => ({ en: item.en, zh: item.zh, command: item.command }));
  const next = fixPlan.review.slice(0, 3).map((change) => ({ en: `Review generated change for ${change.path}.`, zh: `\u5ba1\u67e5 ${change.path} \u7684\u751f\u6210\u4fee\u6539\u3002`, path: change.path }));
  const later = [
    { en: "Publish the RepoReady badge and public report.", zh: "\u53d1\u5e03 RepoReady badge \u548c\u516c\u5f00\u62a5\u544a\u3002" },
    { en: "Use policy checks as an AI-agent readiness gate in CI.", zh: "\u5728 CI \u4e2d\u4f7f\u7528\u7b56\u7565\u68c0\u67e5\u4f5c\u4e3a AI agent \u9002\u914d\u95e8\u7981\u3002" }
  ];
  return {
    posture,
    summary: summaryByPosture[posture],
    readinessGap: Math.max(0, 100 - scores.overall),
    riskLevel: agentFailureRisk?.overallLevel === "critical" ? "critical" : dangerousScripts.length || highIssues >= 3 ? "high" : highIssues || mediumIssues >= 3 ? "medium" : "low",
    fixability: { safe: fixPlan.safe.length, review: fixPlan.review.length, manual: fixPlan.manual.length, total: fixes.changes.length },
    priorityActions: priorityActions.slice(0, 5),
    automationBoundary,
    growthPlan: [
      { en: "Add a RepoReady badge to README after the report is stable.", zh: "\u62a5\u544a\u7a33\u5b9a\u540e\uff0c\u5728 README \u4e2d\u6dfb\u52a0 RepoReady badge\u3002" },
      { en: "Share the public report page with a short before/after note.", zh: "\u5206\u4eab\u516c\u5f00\u62a5\u544a\u9875\uff0c\u5e76\u9644\u4e0a\u7b80\u77ed\u7684\u524d\u540e\u5bf9\u6bd4\u8bf4\u660e\u3002" },
      { en: "Use Fix PR as the main call-to-action instead of only showing scores.", zh: "\u628a Fix PR \u4f5c\u4e3a\u4e3b\u8981\u884c\u52a8\u5165\u53e3\uff0c\u800c\u4e0d\u662f\u53ea\u5c55\u793a\u5206\u6570\u3002" }
    ],
    agentFailureRiskSummary: agentFailureRisk ? { en: agentFailureRisk.summary, zh: agentFailureRisk.summaryZh, level: agentFailureRisk.overallLevel } : null,
    recommendedPath: { now, next, later },
    evidenceConfidence: Math.round(((evidence || []).filter((item) => item.status === "pass").length / Math.max((evidence || []).length, 1)) * 100),
    deepSignals: { readmeGrade: deepAnalysis.readmeQuality?.grade, dependencyScore: deepAnalysis.dependencyHealth?.score, taskCount: deepAnalysis.taskGraph?.totalTasks }
  };
}

function buildScoreBreakdown({ agentFiles, commands, contextNoise, readmeSignals, repoHealth, dangerousScripts, codeQuality }) {
  const item = (id, label, labelZh, earned, max, detail = "") => ({ id, label, labelZh, earned, max, detail });
  return {
    agentReady: [
      item("agent-instructions", "Agent instructions", "\u0041gent \u534f\u4f5c\u8bf4\u660e", agentFiles.agentsMd ? 28 : 0, 28, "AGENTS.md"),
      item("claude-instructions", "Claude instructions", "\u0043laude \u8bf4\u660e", agentFiles.claudeMd ? 8 : 0, 8, "CLAUDE.md"),
      item("cursor-rules", "Cursor rules", "\u0043ursor \u89c4\u5219", agentFiles.cursorRules ? 8 : 0, 8, ".cursor/rules"),
      item("test-command", "Test command", "\u6d4b\u8bd5\u547d\u4ee4", commands.test ? 20 : 0, 20, commands.test || ""),
      item("build-command", "Build command", "\u6784\u5efa\u547d\u4ee4", commands.build ? 15 : 0, 15, commands.build || ""),
      item("usage-docs", "Usage docs", "\u4f7f\u7528\u8bf4\u660e", readmeSignals.hasUsage ? 8 : 0, 8),
      item("ci", "CI workflow", "\u0043I \u5de5\u4f5c\u6d41", repoHealth.hasCi ? 13 : 0, 13)
    ],
    contributorReady: [
      item("readme", "README", "README", readmeSignals.exists ? 14 : 0, 14),
      item("install-docs", "Install docs", "\u5b89\u88c5\u8bf4\u660e", readmeSignals.hasInstall ? 15 : 0, 15),
      item("usage-docs", "Usage docs", "\u4f7f\u7528\u8bf4\u660e", readmeSignals.hasUsage ? 15 : 0, 15),
      item("test-docs", "Testing docs", "\u6d4b\u8bd5\u8bf4\u660e", readmeSignals.hasTest ? 10 : 0, 10),
      item("contributing", "Contributing docs", "\u8d21\u732e\u8bf4\u660e", readmeSignals.hasContributing ? 10 : 0, 10),
      item("templates", "Issue/PR templates", "\u0049ssue/PR \u6a21\u677f", (repoHealth.hasIssueTemplate ? 8 : 0) + (repoHealth.hasPrTemplate ? 8 : 0), 16),
      item("license", "License", "\u8bb8\u53ef\u8bc1", repoHealth.hasLicense ? 5 : 0, 5)
    ],
    contextQuality: [
      item("generated-files", "Generated/cache files", "\u751f\u6210\u7269/\u7f13\u5b58\u6587\u4ef6", Math.max(0, 35 - Math.min(25, contextNoise.generatedFilesTracked.length * 3)), 35),
      item("large-files", "Large files", "\u5927\u6587\u4ef6", Math.max(0, 30 - Math.min(25, contextNoise.largeFiles.length * 8)), 30),
      item("ignore-rules", "Ignore rules", "\u5ffd\u7565\u89c4\u5219", Math.max(0, 20 - Math.min(15, contextNoise.missingIgnoreRules.length * 2)), 20),
      item("gitignore", ".gitignore", ".gitignore", repoHealth.hasGitignore ? 10 : 0, 10)
    ],
    safety: [
      item("dangerous-scripts", "Dangerous scripts", "\u5371\u9669\u811a\u672c", dangerousScripts.length ? Math.max(0, 60 - dangerousScripts.length * 25) : 60, 60),
      item("env-files", "Committed env files", "\u5df2\u63d0\u4ea4\u73af\u5883\u53d8\u91cf\u6587\u4ef6", repoHealth.envFiles.length ? 0 : 40, 40)
    ],
    codeQuality: codeQuality.items.map((q) => item(q.id, q.label, q.labelZh || q.label, q.passed ? q.points : 0, q.points, q.detail))
  };
}

function calculateScores({ agentFiles, commands, dangerousScripts, contextNoise, readmeSignals, fileSet, repoHealth, codeQuality }) {
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
    codeQuality: clamp(codeQuality?.score ?? 0),
    confidence: {
      agentReady: dimensions.agentReady.confidence,
      contributorReady: dimensions.contributorReady.confidence,
      contextQuality: dimensions.contextQuality.confidence,
      safety: dimensions.safety.confidence,
      codeQuality: calculateConfidence(codeQuality?.items?.map((item) => item.passed) || [])
    }
  };
  scores.overall = clamp((scores.agentReady + scores.contributorReady + scores.contextQuality + scores.safety) / 4);
  return scores;
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
  const enriched = changes.map(enrichFixChange);
  return { changes: enriched, count: enriched.length };
}

function enrichFixChange(change) {
  const lower = change.path.toLowerCase();
  const defaults = { reason: "RepoReady generated this file to improve AI-agent readiness.", reasonZh: "RepoReady \u751f\u6210\u8be5\u6587\u4ef6\u4ee5\u63d0\u5347 AI agent \u9002\u914d\u5ea6\u3002", risk: "review" };
  if (lower === "agents.md") return { ...change, reason: "Agent instructions are missing, so coding agents need explicit structure, commands, rules, and safety boundaries.", reasonZh: "\u7f3a\u5c11 Agent \u534f\u4f5c\u8bf4\u660e\uff0ccoding agent \u9700\u8981\u660e\u786e\u7684\u7ed3\u6784\u3001\u547d\u4ee4\u3001\u89c4\u5219\u548c\u5b89\u5168\u8fb9\u754c\u3002", risk: "safe" };
  if (lower === ".env.example") return { ...change, reason: "A safe environment template helps contributors without committing real secrets.", reasonZh: "\u5b89\u5168\u7684\u73af\u5883\u53d8\u91cf\u6a21\u677f\u80fd\u5e2e\u52a9\u8d21\u732e\u8005\u914d\u7f6e\u9879\u76ee\uff0c\u540c\u65f6\u907f\u514d\u63d0\u4ea4\u771f\u5b9e\u5bc6\u94a5\u3002", risk: "safe" };
  if (lower.includes("issue_template")) return { ...change, reason: "Issue templates make bug reports easier for maintainers and agents to triage.", reasonZh: "Issue \u6a21\u677f\u8ba9\u7ef4\u62a4\u8005\u548c agent \u66f4\u5bb9\u6613\u5206\u8bca\u95ee\u9898\u3002", risk: "safe" };
  if (lower.includes("pull_request_template")) return { ...change, reason: "PR templates encourage reviewable changes with validation notes.", reasonZh: "PR \u6a21\u677f\u4fc3\u4f7f\u8d21\u732e\u8005\u63d0\u4ea4\u53ef\u5ba1\u67e5\u3001\u5e26\u9a8c\u8bc1\u8bf4\u660e\u7684\u4fee\u6539\u3002", risk: "safe" };
  if (lower === "readme.md") return { ...change, reason: "README onboarding is incomplete, so agents and contributors need clearer install, usage, testing, and contribution guidance.", reasonZh: "README \u4e0a\u624b\u8bf4\u660e\u4e0d\u5b8c\u6574\uff0cagent \u548c\u8d21\u732e\u8005\u9700\u8981\u66f4\u6e05\u6670\u7684\u5b89\u88c5\u3001\u4f7f\u7528\u3001\u6d4b\u8bd5\u548c\u8d21\u732e\u6307\u5f15\u3002", risk: "review" };
  if (lower === ".gitignore") return { ...change, reason: "Ignore rules keep generated files, caches, and secrets out of agent context.", reasonZh: "\u5ffd\u7565\u89c4\u5219\u80fd\u907f\u514d\u751f\u6210\u7269\u3001\u7f13\u5b58\u548c\u5bc6\u94a5\u6c61\u67d3 agent \u4e0a\u4e0b\u6587\u3002", risk: "review" };
  if (lower.startsWith(".github/workflows/")) return { ...change, reason: "A minimal CI workflow makes agent-authored pull requests easier to validate.", reasonZh: "\u6700\u5c0f CI \u5de5\u4f5c\u6d41\u8ba9 agent \u751f\u6210\u7684 PR \u66f4\u5bb9\u6613\u88ab\u9a8c\u8bc1\u3002", risk: "review" };
  return { ...change, ...defaults };
}

export function filterFixes(fixes, groups = []) {
  if (!groups || groups.length === 0 || groups.includes("all")) return fixes;
  const normalized = new Set(groups.map((group) => String(group).trim().toLowerCase()).filter(Boolean));
  const groupForPath = (filePath) => {
    const lower = filePath.toLowerCase();
    if (lower === "agents.md" || lower === "claude.md" || lower.startsWith(".cursor/")) return "agents";
    if (lower === "readme.md" || lower.startsWith("docs/")) return "readme";
    if (lower.startsWith(".github/workflows/")) return "ci";
    if (lower.includes("issue_template") || lower.includes("pull_request_template")) return "templates";
    if (lower === ".gitignore" || lower === ".env.example") return "config";
    return "other";
  };
  const changes = fixes.changes.filter((change) => normalized.has(groupForPath(change.path)));
  return { ...fixes, changes, count: changes.length };
}

export function renderDoctorReport(report, options = {}) {
  const zh = options.lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const strengths = (report.evidence || []).filter((item) => item.status === "pass").slice(0, 6);
  const risks = [
    ...(report.evidence || []).filter((item) => item.status !== "pass"),
    ...report.issues.filter((issue) => !issue.fixable).map((issue) => ({
      title: issue.title,
      titleZh: issue.titleZh,
      detail: issue.severity
    }))
  ].slice(0, 6);
  const next = report.recommendations[0] || {
    en: "Keep the repository healthy by running RepoReady after major changes.",
    zh: "在重大修改后继续运行 RepoReady，保持仓库健康。"
  };
  const diagnosis = report.scores.agentReady >= 80 && report.scores.contributorReady >= 80
    ? t("This repository is highly ready for AI coding agents and contributors.", "该仓库已经高度适合 AI 编程代理和贡献者协作。")
    : report.scores.agentReady >= 50
      ? t("This repository is partially ready, but several signals still need improvement.", "该仓库已经部分适配，但仍有若干关键信号需要改进。")
      : t("This repository is not ready for reliable AI agent collaboration yet.", "该仓库暂时还不适合可靠的 AI 编程代理协作。");
  const line = (item) => `- ${zh ? item.titleZh : item.title}${item.detail ? ` — ${item.detail}` : ""}`;
  return [
    `# RepoReady ${t("Doctor Report", "诊断报告")}`,
    "",
    `## ${t("Diagnosis", "诊断结论")}`,
    "",
    diagnosis,
    "",
    `## ${t("Strengths", "优势")}`,
    "",
    strengths.map(line).join("\n") || `- ${t("No strong signals detected yet.", "暂未检测到明显优势信号。")}`,
    "",
    `## ${t("Risks", "风险")}`,
    "",
    risks.map(line).join("\n") || `- ${t("No major risks detected.", "暂未发现主要风险。")}`,
    "",
    `## ${t("Recommended next step", "推荐下一步")}`,
    "",
    `- ${zh ? next.zh : next.en}`,
    ""
  ].join("\n");
}

export function buildAgentTasks(report, options = {}) {
  const zh = options.lang === "zh";
  const tasks = [];
  const add = ({ title, titleZh, risk = "low", files = [], prompt, promptZh, estimatedMinutes = 15 }) => {
    tasks.push({
      title: zh ? titleZh : title,
      titleEn: title,
      titleZh,
      risk,
      files,
      estimatedMinutes,
      prompt: zh ? promptZh : prompt,
      promptEn: prompt,
      promptZh
    });
  };

  if (!report.agentFiles?.any) {
    add({
      title: "Create agent instructions",
      titleZh: "创建 Agent 协作说明",
      risk: "low",
      files: ["AGENTS.md"],
      prompt: "Please create an AGENTS.md file that explains the project structure, common commands, coding rules, and safety boundaries for AI coding agents.",
      promptZh: "请创建 AGENTS.md，说明项目结构、常用命令、编码规范和 AI 编程代理需要遵守的安全边界。"
    });
  }
  if (!report.commands?.test) {
    add({
      title: "Add or document a test command",
      titleZh: "添加或说明测试命令",
      risk: "medium",
      files: ["package.json", "README.md"],
      prompt: "Please identify the appropriate test command for this repository, add it to package scripts if applicable, and document it in README.",
      promptZh: "请识别该仓库适合的测试命令，如适用则加入 package scripts，并在 README 中说明。"
    });
  }
  if (!report.repoHealth?.hasCi) {
    add({
      title: "Add minimal CI workflow",
      titleZh: "添加最小 CI 工作流",
      risk: "medium",
      files: [".github/workflows/repoready.yml"],
      prompt: "Please add a minimal GitHub Actions workflow that checks out the repo, sets up Node.js when needed, and runs the test command.",
      promptZh: "请添加一个最小 GitHub Actions 工作流，拉取代码，根据需要设置 Node.js，并运行测试命令。"
    });
  }
  if (!report.readme?.hasInstall || !report.readme?.hasUsage || !report.readme?.hasTest) {
    add({
      title: "Improve README onboarding sections",
      titleZh: "完善 README 上手说明",
      risk: "low",
      files: ["README.md"],
      prompt: "Please improve README by adding clear Installation, Usage, Testing, and Contributing sections with concrete commands from this repository.",
      promptZh: "请完善 README，补充清晰的安装、使用、测试和贡献说明，并使用本仓库的真实命令。"
    });
  }
  if ((report.scores?.codeQuality || 0) < 80) {
    add({
      title: "Improve code quality signals",
      titleZh: "增强代码质量信号",
      risk: "low",
      files: ["package.json", ".github/workflows"],
      prompt: "Please add or improve lint/check/test scripts and make sure CI can run the safe validation commands.",
      promptZh: "请添加或改进 lint/check/test 脚本，并确保 CI 可以运行安全的验证命令。"
    });
  }

  if (!tasks.length) {
    add({
      title: "Review optional polish tasks",
      titleZh: "审查可选优化任务",
      risk: "low",
      files: ["README.md", "AGENTS.md"],
      prompt: "Please review this repository for small documentation and onboarding improvements that would help future AI coding agents and contributors.",
      promptZh: "请审查该仓库，寻找有助于未来 AI 编程代理和贡献者的小型文档与上手体验改进。"
    });
  }
  return tasks;
}

export function renderAgentTasks(report, options = {}) {
  const zh = options.lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const tasks = buildAgentTasks(report, options);
  const lines = [`# RepoReady ${t("Agent Tasks", "Agent 任务")}`, ""];
  tasks.forEach((task, index) => {
    lines.push(`## ${index + 1}. ${task.title}`);
    lines.push("");
    lines.push(`- ${t("Risk", "风险")}: ${task.risk}`);
    lines.push(`- ${t("Estimated", "预计")}: ${task.estimatedMinutes} min`);
    lines.push(`- ${t("Files", "文件")}: ${task.files.join(", ") || "-"}`);
    lines.push("");
    lines.push(t("Suggested prompt:", "建议 Prompt："));
    lines.push("");
    lines.push(`> ${task.prompt}`);
    lines.push("");
  });
  return lines.join("\n");
}

export function generateContextPack(report, options = {}) {
  const zh = options.lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const commands = report.commands || {};
  const evidence = (report.evidence || []).map((item) => `- ${item.status === "pass" ? "PASS" : "REVIEW"}: ${zh ? item.titleZh : item.title}${item.detail ? ` — ${item.detail}` : ""}`).join("\n");
  const tasks = buildAgentTasks(report, options);
  const changes = [
    {
      path: ".repo-ready/context/project-map.md",
      action: "create",
      content: `# ${t("Project Map", "项目地图")}\n\n- ${t("Repository", "仓库")}: ${report.repository.name}\n- ${t("Languages", "语言")}: ${report.stack.languages.join(", ") || "Unknown"}\n- ${t("Frameworks", "框架")}: ${report.stack.frameworks.join(", ") || "Unknown"}\n- ${t("Package manager", "包管理器")}: ${report.stack.packageManager}\n\n## ${t("Detected signals", "检测信号")}\n\n${evidence || "- None"}\n`
    },
    {
      path: ".repo-ready/context/commands.md",
      action: "create",
      content: `# ${t("Commands", "命令")}\n\n- Install: ${report.stack.packageManager === "pnpm" ? "pnpm install" : report.stack.packageManager === "yarn" ? "yarn install" : report.stack.packageManager === "npm" ? "npm install" : "document project-specific install command"}\n- Dev: ${commands.dev || "not detected"}\n- Test: ${commands.test || "not detected"}\n- Build: ${commands.build || "not detected"}\n- Lint: ${commands.lint || "not detected"}\n- Check: ${commands.typecheck || "not detected"}\n`
    },
    {
      path: ".repo-ready/context/safety-boundaries.md",
      action: "create",
      content: `# ${t("Safety Boundaries", "安全边界")}\n\n- ${t("Do not run destructive, deployment, database reset, or force-push commands without explicit approval.", "未经明确授权，不要运行破坏性、部署、数据库重置或强制推送命令。")}\n- ${t("Prefer dry-run and diff review before writing files.", "写入文件前优先使用 dry-run 和 diff 审查。")}\n\n## ${t("Detected risky scripts", "检测到的风险脚本")}\n\n${report.dangerousScripts.map((script) => `- ${script.name}: ${script.command}`).join("\n") || "- None"}\n`
    },
    {
      path: ".repo-ready/context/task-suggestions.md",
      action: "create",
      content: `# ${t("Agent Task Suggestions", "Agent 任务建议")}\n\n${tasks.map((task, index) => `## ${index + 1}. ${task.title}\n\n- Risk: ${task.risk}\n- Files: ${task.files.join(", ") || "-"}\n\n> ${task.prompt}\n`).join("\n")}`
    },
    {
      path: ".repo-ready/context/ai-agent-brief.md",
      action: "create",
      content: `# ${t("AI Agent Brief", "AI Agent 简报")}\n\n${t("This repository has been summarized by RepoReady for AI coding agents.", "本文件由 RepoReady 为 AI 编程代理生成。")}\n\n## Scores\n\n- Overall: ${report.scores.overall}/100\n- Agent Ready: ${report.scores.agentReady}/100\n- Contributor Ready: ${report.scores.contributorReady}/100\n- Context Quality: ${report.scores.contextQuality}/100\n- Safety: ${report.scores.safety}/100\n- Code Quality: ${report.scores.codeQuality}/100\n\n## ${t("Recommended first task", "推荐第一个任务")}\n\n${tasks[0] ? tasks[0].prompt : "Review the repository and propose small safe improvements."}\n`
    }
  ];
  return { changes, count: changes.length };
}

export function renderAgentReadySpec(options = {}) {
  const zh = options.lang === "zh";
  if (zh) {
    return `# Agent Ready Repository Standard

RepoReady 定义的 AI 编程代理仓库适配标准。

## 1. 必备协作说明
- 必须有 AGENTS.md，说明项目结构、命令、编码规范和安全边界。
- 推荐补充 CLAUDE.md、.cursor/rules 等 agent-specific 文件。

## 2. 必备命令
- Install：安装依赖。
- Dev：本地开发。
- Test：验证修改。
- Build：验证生产构建。
- Lint/Check：基础质量检查。

## 3. README 上手路径
- 项目简介。
- 安装方式。
- 使用方式。
- 测试方式。
- 贡献方式。

## 4. Safety boundaries
- 不允许未授权运行破坏性命令。
- 不允许未授权生产部署。
- 数据库、认证、支付、密钥相关修改必须人工审查。

## 5. Context quality
- 忽略 node_modules、dist、build、coverage、缓存目录。
- 避免提交大文件和生成物。
- 提供 .env.example，避免提交真实 .env。

## 6. Agent task readiness
- 任务应小而明确。
- 文件范围应清楚。
- 必须有验证命令。
- 高风险修改必须人工确认。
`;
  }
  return `# Agent Ready Repository Standard

RepoReady's standard for repositories that are understandable, testable, safe, and actionable for AI coding agents.

## 1. Agent instructions
- A repository should include AGENTS.md with project structure, commands, coding rules, and safety boundaries.
- Agent-specific files such as CLAUDE.md and .cursor/rules are recommended.

## 2. Required commands
- Install: install dependencies.
- Dev: run local development.
- Test: validate code changes.
- Build: validate production readiness.
- Lint/Check: run basic quality checks.

## 3. README onboarding
- Project description.
- Installation.
- Usage.
- Testing.
- Contribution guidance.

## 4. Safety boundaries
- Do not run destructive commands without approval.
- Do not deploy to production without approval.
- Database, auth, payment, and secret-related changes require human review.

## 5. Context quality
- Ignore node_modules, dist, build, coverage, and cache directories.
- Avoid committed generated files and large artifacts.
- Provide .env.example instead of committing real .env files.

## 6. Agent task readiness
- Tasks should be small and explicit.
- File scope should be clear.
- Validation commands should be available.
- High-risk changes require human confirmation.
`;
}

export function buildDefaultPolicy() {
  return {
    agent: {
      require_agent_instructions: true,
      require_test_command: true,
      require_ci: true
    },
    safety: {
      block_dangerous_scripts: true,
      flag_large_files: true,
      require_human_review_for: ["database", "deployment", "auth", "payment", "secrets"]
    },
    fix: {
      allow_auto_create: ["AGENTS.md", "README sections", "GitHub Actions", "issue templates", "PR templates"],
      require_review_for: ["package scripts", "CI changes", "deployment files"]
    }
  };
}

export function renderPolicyYaml(policy = buildDefaultPolicy()) {
  const list = (items, indent = "    ") => items.map((item) => `${indent}- ${item}`).join("\n");
  return `agent:
  require_agent_instructions: ${Boolean(policy.agent?.require_agent_instructions)}
  require_test_command: ${Boolean(policy.agent?.require_test_command)}
  require_ci: ${Boolean(policy.agent?.require_ci)}

safety:
  block_dangerous_scripts: ${Boolean(policy.safety?.block_dangerous_scripts)}
  flag_large_files: ${Boolean(policy.safety?.flag_large_files)}
  require_human_review_for:
${list(policy.safety?.require_human_review_for || [])}

fix:
  allow_auto_create:
${list(policy.fix?.allow_auto_create || [])}
  require_review_for:
${list(policy.fix?.require_review_for || [])}
`;
}

export function buildPolicyTemplate() {
  return renderPolicyYaml(buildDefaultPolicy());
}

export function checkPolicyCompliance(report, policy = buildDefaultPolicy()) {
  const checks = [];
  const add = (id, passed, severity, en, zh, detail = "") => checks.push({ id, passed, severity, en, zh, detail });
  add("agent-instructions", !policy.agent?.require_agent_instructions || report.agentFiles?.any, "high", "Agent instructions are required.", "需要 Agent 协作说明。");
  add("test-command", !policy.agent?.require_test_command || Boolean(report.commands?.test), "high", "A test command is required.", "需要测试命令。");
  add("ci", !policy.agent?.require_ci || report.repoHealth?.hasCi, "medium", "A CI workflow is required.", "需要 CI 工作流。");
  add("dangerous-scripts", !policy.safety?.block_dangerous_scripts || report.dangerousScripts.length === 0, "critical", "Dangerous scripts are blocked by policy.", "策略禁止危险脚本。", report.dangerousScripts.map((s) => s.name).join(", "));
  add("large-files", !policy.safety?.flag_large_files || report.contextNoise.largeFiles.length === 0, "medium", "Large files require review.", "大文件需要审查。", `${report.contextNoise.largeFiles.length} large files`);
  const violations = checks.filter((check) => !check.passed);
  const weights = { critical: 35, high: 25, medium: 15, low: 5 };
  const penalty = violations.reduce((sum, item) => sum + (weights[item.severity] || 10), 0);
  return {
    score: Math.max(0, Math.round(100 - penalty)),
    checks,
    violations,
    passed: violations.length === 0
  };
}

export function evaluatePolicy(report, policy = buildDefaultPolicy()) {
  return checkPolicyCompliance(report, policy);
}

export function renderPolicyCompliance(compliance, options = {}) {
  const zh = options.lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const lines = [`# RepoReady ${t("Policy Compliance", "策略合规")}`, "", `${t("Score", "分数")}: ${compliance.score}/100`, ""];
  lines.push(`## ${t("Violations", "违规项")}`);
  if (!compliance.violations.length) lines.push(`- ${t("No policy violations detected.", "未发现策略违规。")}`);
  for (const item of compliance.violations) {
    lines.push(`- [${item.severity}] ${zh ? item.zh : item.en}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  lines.push("");
  lines.push(`## ${t("Checks", "检查项")}`);
  for (const item of compliance.checks) {
    lines.push(`- ${item.passed ? "PASS" : "FAIL"} ${item.id}`);
  }
  return lines.join("\n");
}

export function renderPolicyReport(compliance, options = {}) {
  return renderPolicyCompliance(compliance, options);
}

export function buildFixPlan(report) {
  const changes = report.fixes?.changes || [];
  const isSafePath = (filePath) => {
    const lower = filePath.toLowerCase();
    return lower === "agents.md" || lower === ".env.example" || lower.includes("issue_template") || lower.includes("pull_request_template");
  };
  const requiresReviewPath = (filePath) => {
    const lower = filePath.toLowerCase();
    return lower === "readme.md" || lower === ".gitignore" || lower.startsWith(".github/workflows/");
  };
  const safe = changes.filter((change) => change.risk === "safe" || isSafePath(change.path));
  const review = changes.filter((change) => change.risk === "review" || requiresReviewPath(change.path)).filter((change) => !safe.includes(change));
  const manual = [];
  if ((report.dangerousScripts || []).length) manual.push({ id: "dangerous-scripts", severity: "high", en: "Review dangerous scripts manually.", zh: "\u4eba\u5de5\u5ba1\u67e5\u5371\u9669\u811a\u672c\u3002" });
  if ((report.repoHealth?.envFiles || []).length) manual.push({ id: "committed-env-file", severity: "critical", en: "Remove committed env files manually and rotate exposed secrets.", zh: "\u4eba\u5de5\u79fb\u9664\u5df2\u63d0\u4ea4\u7684 env \u6587\u4ef6\uff0c\u5e76\u8f6e\u6362\u53ef\u80fd\u6cc4\u9732\u7684\u5bc6\u94a5\u3002" });
  return { safe, review, manual, counts: { safe: safe.length, review: review.length, manual: manual.length } };
}

export function renderFixPlan(plan, options = {}) {
  const zh = options.lang === "zh";
  const t = (en, cn) => (zh ? cn : en);
  const lines = [`# RepoReady ${t("Fix Plan", "\u4fee\u590d\u8ba1\u5212")}`, ""];
  const renderChange = (change) => `- ${change.path}${change.reason || change.reasonZh ? ` \u2014 ${zh ? change.reasonZh : change.reason}` : ""}`;
  lines.push(`## ${t("Safe automatic fixes", "\u5b89\u5168\u81ea\u52a8\u4fee\u590d")}`);
  lines.push(...(plan.safe.length ? plan.safe.map(renderChange) : [`- ${t("None", "\u65e0")}`]));
  lines.push("");
  lines.push(`## ${t("Needs review", "\u9700\u8981\u5ba1\u67e5")}`);
  lines.push(...(plan.review.length ? plan.review.map(renderChange) : [`- ${t("None", "\u65e0")}`]));
  lines.push("");
  lines.push(`## ${t("Manual only", "\u4ec5\u9650\u4eba\u5de5\u5904\u7406")}`);
  lines.push(...(plan.manual.length ? plan.manual.map((item) => `- [${item.severity}] ${zh ? item.zh : item.en}`) : [`- ${t("None", "\u65e0")}`]));
  return lines.join("\n");
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
  if (report.strategy) {
    lines.push(t("Strategy", "策略"));
    lines.push(`- ${report.strategy.summary[zh ? "zh" : "en"]}`);
    for (const action of report.strategy.priorityActions.slice(0, 3)) {
      lines.push(`- [${action.impact}/${action.effort}] ${zh ? action.zh : action.en}`);
    }
    lines.push("");
  }
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
    ["Safety", report.scores.safety],
    ["Code Quality", report.scores.codeQuality]
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
| Code Quality | ${((report.scores.confidence.codeQuality || 0) * 100).toFixed(0)}% |

${renderStrategyMarkdown(report, zh)}

${renderAgentFailureRiskMarkdown(report, zh)}

## ${t("Evidence", "证据链")}

${(report.evidence || []).map((e) => `- ${e.status === "pass" ? "✓" : "!"} ${zh ? e.titleZh : e.title}${e.detail ? ` — ${e.detail}` : ""}`).join("\n") || `- ${t("No evidence available.", "暂无证据。")}`}

## ${t("Score Breakdown", "评分拆解")}

${renderScoreBreakdownMarkdown(report, zh)}

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

function renderScoreBreakdownMarkdown(report, zh) {
  if (!report.scoreBreakdown) return zh ? "暂无评分拆解。" : "No score breakdown available.";
  const names = {
    agentReady: zh ? "Agent Ready" : "Agent Ready",
    contributorReady: zh ? "Contributor Ready" : "Contributor Ready",
    contextQuality: zh ? "Context Quality" : "Context Quality",
    safety: zh ? "Safety" : "Safety",
    codeQuality: zh ? "Code Quality" : "Code Quality"
  };
  const sections = [];
  for (const [key, items] of Object.entries(report.scoreBreakdown)) {
    sections.push(`### ${names[key] || key}`);
    for (const item of items.slice(0, 8)) {
      const label = zh ? item.labelZh : item.label;
      sections.push(`- ${label}: ${item.earned}/${item.max}${item.detail ? ` — ${item.detail}` : ""}`);
    }
    sections.push("");
  }
  return sections.join("\n");
}


function renderAgentFailureRiskMarkdown(report, zh) {
  const afr = report.agentFailureRisk;
  if (!afr) return "";
  const t = (en, cn) => (zh ? cn : en);
  const risks = (afr.topRisks?.length ? afr.topRisks : afr.risks || []).slice(0, 5);
  const body = risks.map((risk) => {
    const evidence = (risk.evidence || []).map((item) => `  - ${item.source}: ${item.detail}`).join("\n");
    return `### ${zh ? risk.titleZh : risk.title}\n\n- ${t("Level", "\u7b49\u7ea7")}: **${risk.level}** (${risk.score}/100)\n- ${t("Why agents fail", "\u4e3a\u4ec0\u4e48 agent \u4f1a\u5931\u8d25")}: ${zh ? risk.whyAgentsFailZh : risk.whyAgentsFail}\n- ${t("Mitigation", "\u7f13\u89e3\u65b9\u5f0f")}: ${zh ? risk.mitigationZh : risk.mitigation}\n- ${t("Fixability", "\u4fee\u590d\u5c5e\u6027")}: **${risk.fixability}**\n${evidence ? `- ${t("Evidence", "\u8bc1\u636e")}\n${evidence}` : ""}`;
  }).join("\n\n");
  return `## ${t("Agent Failure Risk", "Agent \u5931\u8d25\u98ce\u9669")}\n\n- ${t("Overall level", "\u6574\u4f53\u7b49\u7ea7")}: **${afr.overallLevel}**\n- ${zh ? afr.summaryZh : afr.summary}\n\n${body || `- ${t("No major agent failure risks detected.", "\u672a\u53d1\u73b0\u4e3b\u8981 agent \u5931\u8d25\u98ce\u9669\u3002")}`}\n`;
}

function renderStrategyMarkdown(report, zh) {
  const strategy = report.strategy;
  if (!strategy) return "";
  const t = (en, cn) => (zh ? cn : en);
  const actions = strategy.priorityActions.map((action) => `- **${action.impact}/${action.effort}**: ${zh ? action.zh : action.en}${action.command ? `\n  - \`${action.command}\`` : ""}`).join("\n");
  const boundaries = strategy.automationBoundary.map((item) => `- **${item.level}**: ${zh ? item.zh : item.en}`).join("\n");
  const growth = strategy.growthPlan.map((item) => `- ${zh ? item.zh : item.en}`).join("\n");
  const recommendedPath = strategy.recommendedPath ? [
    `#### ${t("Now", "\u73b0\u5728")}`,
    ...(strategy.recommendedPath.now?.length ? strategy.recommendedPath.now.map((item) => `- ${zh ? item.zh : item.en}${item.command ? `\n  - \`${item.command}\`` : ""}`) : [`- ${t("No immediate action.", "\u6682\u65e0\u7acb\u5373\u52a8\u4f5c\u3002")}`]),
    `#### ${t("Next", "\u4e0b\u4e00\u6b65")}`,
    ...(strategy.recommendedPath.next?.length ? strategy.recommendedPath.next.map((item) => `- ${zh ? item.zh : item.en}`) : [`- ${t("No review-required fixes.", "\u6682\u65e0\u9700\u8981\u5ba1\u67e5\u7684\u4fee\u590d\u3002")}`]),
    `#### ${t("Later", "\u4e4b\u540e")}`,
    ...(strategy.recommendedPath.later?.length ? strategy.recommendedPath.later.map((item) => `- ${zh ? item.zh : item.en}`) : [`- ${t("No later actions.", "\u6682\u65e0\u540e\u7eed\u52a8\u4f5c\u3002")}`])
  ].join("\n") : "";
  return `## ${t("Strategy", "\u7b56\u7565")}\n\n${strategy.summary[zh ? "zh" : "en"]}\n\n- ${t("Posture", "\u6001\u52bf")}: **${strategy.posture}**\n- ${t("Risk level", "\u98ce\u9669\u7b49\u7ea7")}: **${strategy.riskLevel}**\n- ${t("Readiness gap", "\u9002\u914d\u5dee\u8ddd")}: **${strategy.readinessGap}**\n- ${t("Evidence confidence", "\u8bc1\u636e\u53ef\u4fe1\u5ea6")}: **${strategy.evidenceConfidence}%**\n\n### ${t("Priority actions", "\u4f18\u5148\u52a8\u4f5c")}\n\n${actions || `- ${t("No priority actions.", "\u6682\u65e0\u4f18\u5148\u52a8\u4f5c\u3002")}`}\n\n### ${t("Recommended path", "\u63a8\u8350\u8def\u5f84")}\n\n${recommendedPath}\n\n### ${t("Automation boundary", "\u81ea\u52a8\u5316\u8fb9\u754c")}\n\n${boundaries}\n\n### ${t("Growth plan", "\u4f20\u64ad\u8ba1\u5212")}\n\n${growth}\n`;
}

function buildDeepAnalysisMarkdown(report, zh) {
  const t = (en, cn) => (zh ? cn : en);
  const da = report.deepAnalysis;
  if (!da) return "";
  const lines = [];
  const localized = (value, fallbackEn, fallbackZh = fallbackEn) => {
    if (!value) return zh ? fallbackZh : fallbackEn;
    if (typeof value === "string") return value;
    return value[zh ? "zh" : "en"] || value.en || value.zh || (zh ? fallbackZh : fallbackEn);
  };
  if (da.readmeQuality) {
    lines.push(`### README Quality: ${da.readmeQuality.grade} (${da.readmeQuality.score}/100)`);
    lines.push(localized(
      da.readmeQuality.summary,
      "README analysis completed, but no summary was available.",
      "README 分析已完成，但暂无摘要。"
    ));
    lines.push(`Confidence: ${(report.scores.confidence.agentReady * 100).toFixed(0)}%`);
    lines.push("");
  }
  if (da.dependencyHealth) {
    lines.push(`### Dependencies: ${da.dependencyHealth.score}/100`);
    lines.push(localized(
      da.dependencyHealth.summary,
      "Dependency analysis completed, but no summary was available.",
      "依赖分析已完成，但暂无摘要。"
    ));
    lines.push("");
  }
  if (da.safetyBoundaries) {
    lines.push(`### Safety Boundaries: ${da.safetyBoundaries.score}/100`);
    lines.push(localized(
      da.safetyBoundaries.summary,
      "Safety analysis completed, but no summary was available.",
      "安全边界分析已完成，但暂无摘要。"
    ));
    for (const boundary of da.safetyBoundaries.boundaries.slice(0, 3)) {
      lines.push(`- ${zh ? boundary.zh : boundary.en}`);
    }
    lines.push("");
  }
  if (da.taskGraph) {
    lines.push(`### Task Graph: ${da.taskGraph.totalTasks} tasks`);
    lines.push(localized(
      da.taskGraph.summary,
      "Task analysis completed, but no summary was available.",
      "任务分析已完成，但暂无摘要。"
    ));
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
