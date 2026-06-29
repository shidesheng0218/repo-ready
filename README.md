# RepoReady

![RepoReady](https://img.shields.io/badge/RepoReady-agent--ready-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)

> Make your repository ready for Codex, Claude Code, Cursor, and contributors.
>
> 让你的仓库更适合 Codex、Claude Code、Cursor 等 AI 编程代理协作，也更容易被贡献者理解。

RepoReady is an **AI Agent Readiness** checker, policy layer, and fixer for GitHub repositories. It scans a local repository or public GitHub repository, explains the evidence behind each score, and generates reviewable fixes for agent instructions, README sections, GitHub Actions, templates, badges, `.gitignore`, and `.env.example`.

RepoReady 的长期目标不是只做一个“打分工具”，而是成为 AI 编程代理改代码之前的 **preflight / readiness layer**：判断仓库是否可理解、可测试、可安全修改、可拆分任务。

## Install / Run

Run in any repository:

```bash
npx @shidesheng0218/repo-ready@latest
```

Chinese report:

```bash
npx @shidesheng0218/repo-ready@latest --lang zh
```

Preview fixes without writing files:

```bash
npx @shidesheng0218/repo-ready@latest fix --dry-run
```

Create a safe fix plan:

```bash
npx @shidesheng0218/repo-ready@latest fix --plan
```

Apply only safe automatic fixes:

```bash
npx @shidesheng0218/repo-ready@latest fix --apply-safe
```

## What RepoReady checks

- Agent instruction files: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`
- Install / dev / test / build / lint commands
- README onboarding quality: install, usage, test, contributing, demo signals
- CI workflows, license, issue templates, PR templates, `.env.example`
- Context quality: generated files, caches, large files, missing ignore rules
- Dangerous scripts: destructive deletes, force pushes, DB resets, production deploys
- Code quality signals: tests, lint/check commands, lockfiles, test files, CI
- Agent task readiness: whether work can be decomposed into safe, reviewable tasks

## Scores

RepoReady reports five practical scores:

| Score | Meaning |
|---|---|
| Agent Ready | Can Codex / Claude Code / Cursor quickly understand and safely modify the repo? |
| Contributor Ready | Can a new human contributor install, run, test, and contribute? |
| Context Quality | Is the repository context clean, focused, and not overloaded by generated files? |
| Safety | Are scripts and workflows free from obvious high-risk operations? |
| Code Quality | Are there test/lint/check/CI signals that make changes verifiable? |

Reports include **evidence chains** and **score breakdowns**, so the output is not just a number. It explains why the score was given.

## Strategic controls for AI-agent workflows

### Agent Ready Spec

Print the repository standard that RepoReady uses:

```bash
npx @shidesheng0218/repo-ready@latest spec
npx @shidesheng0218/repo-ready@latest spec --lang zh
```

See also: [`docs/agent-ready-spec.md`](docs/agent-ready-spec.md)

### Policy layer

Generate a default policy:

```bash
npx @shidesheng0218/repo-ready@latest policy init
```

Write it to `.repoready/policy.yml`:

```bash
npx @shidesheng0218/repo-ready@latest policy init --write
```

Check the current repository against `.repoready/policy.yml` if present, otherwise against the default policy:

```bash
npx @shidesheng0218/repo-ready@latest policy check
npx @shidesheng0218/repo-ready@latest policy check --lang zh
```

The policy layer is designed for teams that want enforceable rules before AI agents modify code.

### Fix plan

Classify generated fixes into safe, review-required, and manual-only buckets:

```bash
npx @shidesheng0218/repo-ready@latest fix --plan
```

This is the bridge from “scanner” to “safe automation”: RepoReady can create low-risk files automatically while keeping README, CI, deployment, database, auth, payment, and secret-related changes reviewable.

## Agent workflow helpers

Doctor mode:

```bash
npx @shidesheng0218/repo-ready@latest doctor
```

Agent tasks:

```bash
npx @shidesheng0218/repo-ready@latest tasks
```

Context pack preview:

```bash
npx @shidesheng0218/repo-ready@latest context --dry-run
```

Write `.repo-ready/context/*` files:

```bash
npx @shidesheng0218/repo-ready@latest context --write
```

## Fix workflow

Preview all generated fixes:

```bash
npx @shidesheng0218/repo-ready@latest fix --dry-run
```

Write generated fixes:

```bash
npx @shidesheng0218/repo-ready@latest fix --write
```

Create/use a local branch named `repoready/fixes`:

```bash
npx @shidesheng0218/repo-ready@latest fix --branch
```

Create a GitHub PR with generated fixes:

```bash
npx @shidesheng0218/repo-ready@latest fix --pr --base main
```

`fix --pr` requires a git repository, a remote named `origin`, and GitHub CLI authenticated with `gh auth login`.

## Example output

```text
RepoReady Report · my-repo
==========================
Overall Score: 82/100 ████████░░

AI Agent Ready      ███████░░░ 70/100
Contributor Ready   ████████░░ 80/100
Context Quality     █████████░ 90/100
Safety              ████████░░ 85/100
Code Quality        ███████░░░ 72/100

Evidence
  ✓ Agent instructions detected — AGENTS.md
  ✓ Test command detected — npm test
  ✓ GitHub Actions workflow detected — .github/workflows/ci.yml
  ! README is missing contribution guidance

PR-ready Fixes
  + AGENTS.md
  + README.md
  + .github/workflows/repoready.yml
```

## Local development

RepoReady's CLI uses Node.js built-in modules for the core path.

```powershell
cd D:\Github项目\repoready
node packages/cli/bin/repoready.js
node packages/cli/bin/repoready.js --lang zh
node packages/cli/bin/repoready.js fix --dry-run
```

Run tests:

```powershell
node --test
npm.cmd run lint
```

Pack locally:

```powershell
npm.cmd pack --dry-run
```

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

## AI Enhancement is optional

RepoReady works offline with a rules engine. AI enhancement is optional and only runs when the user provides their own API key.

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export REPOREADY_AI_KEY="openai:sk-..."
export REPOREADY_AI_MODEL="gpt-4o-mini"
```

Privacy principle: AI enhancement sends structured analysis results, not the full source code by default.

Cost principle: users pay their own model provider. If no key is configured, RepoReady does not call AI.

## Project structure

```text
packages/core    scanning, scoring, reports, policy, spec, fix generation
packages/cli     local CLI and fix workflow
packages/action  GitHub Action wrapper
apps/web         web report page skeleton
```

## Roadmap

- [x] Local scanner
- [x] Bilingual CLI reports
- [x] JSON and Markdown outputs
- [x] Evidence chain and score breakdown
- [x] Code Quality Score
- [x] Doctor, tasks, and context commands
- [x] Agent Ready Spec
- [x] Policy init/check
- [x] Fix plan and safe-fix classification
- [x] Fix dry-run/write/branch/PR prototype
- [x] GitHub Action wrapper
- [x] Minimal Web report skeleton
- [x] Public report pages for `/r/owner/repo`
- [x] Badge and share-card routes
- [x] GitHub App Fix PR MVP with patch-preview fallback
- [x] Agent Ready Index MVP
- [ ] Organization dashboard
- [ ] More language-specific rules and templates

## Why this matters

AI coding agents fail less when repositories provide clear instructions, validation commands, clean context, and safety boundaries. RepoReady makes those signals visible, measurable, and fixable.

中文一句话：RepoReady 帮你把仓库整理成 AI 编程代理和真人贡献者都更容易理解、更容易验证、更安全协作的状态。

## License

MIT

