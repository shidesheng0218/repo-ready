# RepoReady

![RepoReady](https://img.shields.io/badge/RepoReady-agent--ready-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)

> Make your repository ready for AI coding agents and easier for contributors to understand.
>
> 让你的仓库更适合 AI 编程代理协作，也更容易被贡献者理解。

RepoReady is an AI agent readiness checker and fixer for GitHub repositories. It scans a local repository or public GitHub repository, reports issues that block Codex / Claude Code / Cursor collaboration, and generates safe fix patches for agent instructions, README sections, GitHub Actions, issue templates, PR templates, and badges.

## Try it now

Run RepoReady in any repository:

```bash
npx @shidesheng0218/repo-ready
```

Generate a Chinese report:

```bash
npx @shidesheng0218/repo-ready --lang zh
```

Preview safe, reviewable fixes:

```bash
npx @shidesheng0218/repo-ready fix --dry-run
```

## Why RepoReady?

AI coding agents are only as good as the repository context they receive. If a project lacks agent instructions, test commands, safe workflows, or contributor docs, agents have to guess.

RepoReady checks those missing signals and turns them into concrete, reviewable fixes.

RepoReady 关注的不是“刷 Star”，而是帮你的仓库补齐 AI agent 和贡献者真正需要的信息：项目结构、命令、规范、安全边界和协作入口。

## Demo

```text
RepoReady Report · my-repo
==========================
Overall Score: 82/100 ████████░░

AI Agent Ready      ███████░░░ 70/100
Contributor Ready   ████████░░ 80/100
Context Quality     █████████░ 90/100
Safety              ████████░░ 85/100

Top Issues
  ! [high] Missing AGENTS.md / CLAUDE.md / Cursor rules
  › [medium] No GitHub Actions workflow was detected

PR-ready Fixes
  + AGENTS.md
  + README.md
  + .github/workflows/repoready.yml
```

## Features

- **Agent readiness scan** for Codex, Claude Code, Cursor, and similar coding agents
- **Bilingual reports** in English and Chinese
- **Four practical scores**: Agent Ready, Contributor Ready, Context Quality, Safety
- **Code Quality Score** for test/lint/check/CI/test-file/lockfile signals
- **Evidence and score breakdown** so reports explain why each score was given
- **Weighted scoring with confidence** so the report shows not only the score, but also how reliable the detected signals are
- **Before/after baseline comparison** through `.repoready-baseline.json` and `--save-baseline`
- **Context noise detection** for generated folders, caches, large files, and missing ignore rules
- **Dangerous script detection** for destructive commands, force pushes, database resets, and production deploys
- **Repository health checks** for CI, license, `.env.example`, issue templates, PR templates, and README quality
- **Fix generation** for `AGENTS.md`, README sections, GitHub Actions, templates, badges, `.gitignore`, and `.env.example`
- **Targeted fixes** with `fix --only agents`, `fix --only readme,ci`, `fix --only templates`, or `fix --only config`
- **GitHub PR workflow prototype** via `fix --pr` and GitHub CLI
- **Share card endpoint** for report screenshots and social previews
- **Agent templates** for Next.js, Vue, Python, Rust, Go, and monorepo workspaces
- **Interactive init** mode that guides you through setup step by step
- **CI score diff** that compares RepoReady scores across branches
- **Leaderboard API** for community score tracking

## Quick start

### Local development / 本地运行

RepoReady MVP can run without installing dependencies because the core CLI uses Node.js built-in modules only.

RepoReady MVP 的核心 CLI 只依赖 Node.js 内置模块，因此不安装依赖也可以直接运行。

```powershell
cd D:\Github项目\repoready
```

Run a local scan:

```powershell
node packages/cli/bin/repoready.js
```

中文报告：

```powershell
node packages/cli/bin/repoready.js --lang zh
```

JSON output:

```powershell
node packages/cli/bin/repoready.js --json
```

Markdown output, useful for GitHub Action summaries:

```powershell
node packages/cli/bin/repoready.js --markdown
```

Save the current scores as a before/after baseline:

```powershell
node packages/cli/bin/repoready.js --save-baseline
```

Preview generated fixes without writing files:

```powershell
node packages/cli/bin/repoready.js fix --dry-run
```

Write generated fixes to the current repository:

```powershell
node packages/cli/bin/repoready.js fix --write
```

Create or reset a local fix branch named `repoready/fixes`, then write generated fixes:

```powershell
node packages/cli/bin/repoready.js fix --branch
```

Create a GitHub PR with generated fixes:

```powershell
node packages/cli/bin/repoready.js fix --pr --base main
```

This requires:

- a git repository
- a configured remote named `origin`
- GitHub CLI installed and authenticated with `gh auth login`

Run tests:

```powershell
node --test
```

### Web app / 本地 Web

The Web app is a minimal Next.js report-page skeleton. It requires dependencies.

Web 端是一个最小 Next.js 报告页骨架，需要先安装依赖。

```powershell
cd D:\Github项目\repoready
corepack enable
pnpm install
pnpm --filter @repoready/web dev
```

Then open:

```text
http://localhost:3000
```

Build the Web app:

```powershell
pnpm --filter @repoready/web build
```

If a Windows development cache locks `.next`, use a different build directory:

```powershell
$env:NEXT_DIST_DIR='next-build'
pnpm --filter @repoready/web build
```

### Intended npm usage / 未来 npm 用法

```bash
# from this monorepo
node packages/cli/bin/repoready.js
node packages/cli/bin/repoready.js --lang zh
node packages/cli/bin/repoready.js --json
node packages/cli/bin/repoready.js fix --dry-run
node packages/cli/bin/repoready.js fix --write
node packages/cli/bin/repoready.js fix --branch
```

When published to npm, the intended command is:

```bash
npx @shidesheng0218/repo-ready
npx @shidesheng0218/repo-ready fix --dry-run
```

The package also exposes a `repoready` binary alias after installation:

```bash
npm install -g @shidesheng0218/repo-ready
repoready
repo-ready --lang zh
```

## What it checks

- `AGENTS.md`, `CLAUDE.md`, `.cursor/rules` presence
- package manager, language stack, test/build/dev commands
- Node.js, Python, Rust, Go, Java/Kotlin, PHP, .NET, and Ruby project signals
- monorepo/workspace signals
- GitHub Actions workflows
- license, `.env.example`, issue template, PR template
- README installation, usage, test, and contribution sections
- README demo/screenshot/preview signals
- dangerous scripts such as destructive deletes, force pushes, database resets, and production deploys
- context noise from generated folders, caches, large files, and missing ignore rules
- task suggestions that are safe and useful for AI coding agents

## Scores

- **Agent Ready Score**: how ready the repo is for Codex / Claude Code / Cursor
- **Contributor Ready Score**: how easy the repo is for new contributors
- **Context Quality Score**: how clean and focused the repo context is
- **Safety Score**: how risky scripts and workflows appear

Scores are weighted instead of flat checklists. For example, test/build commands and agent instructions affect Agent Ready more than cosmetic README details. Reports also include confidence values, which estimate how strong the detected signals are.

## Baseline comparison

RepoReady can compare the current scan against a saved baseline:

```bash
node packages/cli/bin/repoready.js --save-baseline
node packages/cli/bin/repoready.js --markdown
```

This creates `.repoready-baseline.json` and makes later Markdown/Web reports show score deltas for Overall, Agent Ready, Contributor Ready, Context Quality, and Safety.

## Safety model

RepoReady never executes repository scripts. Local scans do not upload source code. Fixes are previewed by default and only written with explicit `fix --write` or `fix --branch`.

`fix --pr` creates a local branch, writes generated fixes, commits, pushes, and opens a PR using GitHub CLI. It does not merge the PR.

For safety, `fix --pr` stages only files generated by RepoReady instead of running `git add .`.

## Project structure

```text
packages/core    scanning, scoring, reports, fix generation
packages/cli     local CLI and fix workflow
packages/action  GitHub Action wrapper
apps/web         minimal Next.js report app skeleton
```

## Roadmap

- [x] Local scanner
- [x] Bilingual CLI reports
- [x] JSON and Markdown outputs
- [x] Fix dry-run/write/branch
- [x] GitHub Action wrapper
- [x] Minimal Web report skeleton
- [x] `fix --pr` prototype
- [x] Share card SVG endpoint
- [x] Agent templates and fix --template
- [x] Interactive init mode
- [x] CI score diff and baseline
- [x] Leaderboard endpoint and teaser
- [ ] GitHub App OAuth PR creation
- [ ] Persistent public report pages
- [ ] Share cards and richer Web UI
- [ ] More language-specific rules and templates

## AI Enhancement (optional)

RepoReady works fully offline with pure rule engines. When you configure an AI provider, the analysis is enhanced
with smarter suggestions — but AI is never required and never called without your explicit API key.

### Setup

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic (Claude)
export ANTHROPIC_API_KEY="sk-ant-..."

# Or use RepoReady's unified key format
export REPOREADY_AI_KEY="openai:sk-..."
export REPOREADY_AI_MODEL="gpt-4o-mini"
export REPOREADY_AI_MAX_TOKENS="2000"
```

### What AI enhances

| Module | Without AI | With AI |
|--------|-----------|---------|
| README analysis | Structure score + grade | Personalized improvement suggestions |
| Task graph | Template-based tasks | Repository-specific agent tasks |
| AGENTS.md | Template-based | AI-customized instructions |

### Cost

All AI calls use your own API key. With `gpt-4o-mini`, a typical scan costs **less than $0.001**.
RepoReady shows estimated cost before making any call.

### Privacy

AI enhancement only sends structured analysis results — never your full source code.

## Agent templates

```bash
node packages/cli/bin/repoready.js templates
node packages/cli/bin/repoready.js fix --template next.js --write
```

Available templates: `next.js`, `vue`, `python`, `rust`, `go`, `monorepo/workspace`

## Interactive init

```bash
node packages/cli/bin/repoready.js init
```

## CI score diff

```yaml
name: RepoReady
on: [pull_request]
jobs:
  repoready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./packages/action
        with:
          compare: "true"
          store-baseline: "true"
```

When `compare` is enabled, the Action displays a score diff table in the PR summary.

## Leaderboard

Public report pages automatically submit scores to the in-memory leaderboard API. Fetch the leaderboard at `/leaderboard`.

## GitHub Action

```yaml
name: RepoReady
on: [pull_request, push]
jobs:
  repoready:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./packages/action
        with:
          language: en
          min-score: 70
```
