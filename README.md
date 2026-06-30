# RepoReady

[![npm](https://img.shields.io/npm/v/@shidesheng0218/repo-ready?color=111827&label=npm)](https://www.npmjs.com/package/@shidesheng0218/repo-ready)
![License](https://img.shields.io/badge/license-MIT-10b981)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)

> **Make your repo ready for Codex, Claude Code, Cursor, and contributors.**
>
> **让你的仓库更适合 Codex、Claude Code、Cursor 等 AI 编程代理协作，也更容易被贡献者理解。**

RepoReady is an **AI Coding Agent Readiness Audit + Fix Platform**.

It scans your repository, explains why AI coding agents may fail, produces an audit-grade evidence chain, and generates reviewable fixes such as `AGENTS.md`, README improvements, GitHub Actions, templates, badges, `.gitignore`, and `.env.example`.

RepoReady 不只是一个打分工具。它的目标是成为 AI 编程代理修改代码前的 **preflight / readiness layer**：判断一个仓库是否足够清晰、可验证、安全、可协作、可被 AI agent 和真人贡献者理解。

---

## Quick Start

### macOS / Linux

```bash
npx @shidesheng0218/repo-ready@latest
```

### Windows

```powershell
npx.cmd @shidesheng0218/repo-ready@latest
```

### Chinese report

```bash
npx @shidesheng0218/repo-ready@latest --lang zh
```

Windows:

```powershell
npx.cmd @shidesheng0218/repo-ready@latest --lang zh
```

### JSON / Markdown output

```bash
npx @shidesheng0218/repo-ready@latest --json
npx @shidesheng0218/repo-ready@latest --markdown
```

---

## v0.4.0 Highlights

RepoReady v0.4.0 upgrades the product from a simple readiness scanner into a more credible **AI agent audit and fix platform**.

### 1. Agent Failure Risk

RepoReady predicts where Codex, Claude Code, Cursor, or other coding agents are most likely to fail:

- **Context Confusion** — noisy repo context, generated files, missing ignore rules
- **Validation Gap** — missing test, build, lint, or check commands
- **Safety Boundary** — dangerous scripts, secrets, deployment, DB reset risks
- **Onboarding Gap** — weak README, unclear install / usage / contribution flow
- **Scope Drift** — missing `AGENTS.md`, `CLAUDE.md`, Cursor rules, or project boundaries

### 2. Audit-grade Evidence Chain

RepoReady does not only show a score. It explains:

- what was detected
- where the evidence came from
- why it matters
- how to fix it
- whether the fix is safe, review-required, or manual-only

### 3. Strategy Layer 2.0

RepoReady now provides a strategic readiness brief:

- current posture
- risk level
- evidence confidence
- readiness gap
- priority actions
- automation boundary
- recommended path: now / next / later

### 4. Explainable Fix PR

Generated fixes are designed to be reviewable and understandable.

Fix PRs explain:

- why the PR exists
- what RepoReady detected
- which agent failure risks were found
- what changes are safe
- what needs human review
- what validation commands should be run

### 5. Agent Ready Index

RepoReady can generate index-style reports for multiple repositories, including:

- top agent-ready repositories
- most common blockers
- failure risk distribution
- missing `AGENTS.md` ratio
- missing test command ratio
- dangerous script count
- Chinese and English launch copy

---

## What RepoReady Checks

RepoReady scans practical signals that affect both AI coding agents and human contributors.

| Area | Checks |
|---|---|
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules` |
| Validation | test, build, lint, check commands |
| README quality | install, usage, test, contributing, demo signals |
| CI / workflow | GitHub Actions, validation workflow |
| Contribution flow | issue template, PR template, contribution guide |
| Context quality | generated files, caches, large files, ignored folders |
| Safety | dangerous scripts, force push, DB reset, production deploys |
| Code quality | tests, lint/check scripts, lockfiles, CI signals |
| Agent task readiness | whether work can be split into safe, reviewable tasks |

---

## Scores

RepoReady reports five practical scores:

| Score | Meaning |
|---|---|
| **Agent Ready** | Can Codex / Claude Code / Cursor quickly understand and safely modify the repo? |
| **Contributor Ready** | Can a new human contributor install, run, test, and contribute? |
| **Context Quality** | Is the repository context clean and not overloaded by generated files? |
| **Safety** | Are scripts and workflows free from obvious high-risk operations? |
| **Code Quality** | Are there test, lint, check, and CI signals that make changes verifiable? |

Example:

```text
RepoReady Report · my-repo
==========================

Overall Score: 82/100 ████████░░

AI Agent Ready      ███████░░░ 70/100
Contributor Ready   ████████░░ 80/100
Context Quality     █████████░ 90/100
Safety              ████████░░ 85/100
Code Quality        ███████░░░ 72/100
```

---

## Agent Failure Risk

RepoReady highlights the most likely failure modes for AI coding agents.

Example:

```text
Agent Failure Risk

High · Validation Gap
Agents may modify code but cannot reliably verify whether the change works.

Evidence:
- No test command detected
- No build command detected

Mitigation:
- Add test/build commands to package scripts
- Document validation commands in AGENTS.md
```

Risk categories:

| Risk | Why it matters |
|---|---|
| Context Confusion | Agents may read generated files, wrong folders, or noisy context |
| Validation Gap | Agents cannot confirm whether their changes work |
| Safety Boundary | Agents may accidentally trigger destructive operations |
| Onboarding Gap | Agents and contributors must guess how the project works |
| Scope Drift | Agents may edit the wrong module or expand the task too much |

---

## Evidence Chain

RepoReady produces an audit-style evidence chain.

Example:

```text
Evidence
  ✓ Agent instructions detected — AGENTS.md
  ✓ Test command detected — npm test
  ✓ GitHub Actions workflow detected — .github/workflows/ci.yml
  ! README is missing contribution guidance
  ! No Cursor rules detected
```

Each evidence item can include:

- status: pass / fail / review
- severity
- source file
- impact
- suggested fix
- fixability: safe / review / manual

This makes the report more trustworthy than a simple score.

---

## Fix Workflow

RepoReady is designed to move from diagnosis to safe, reviewable fixes.

### Preview fix plan

```bash
npx @shidesheng0218/repo-ready@latest fix --plan
```

### Preview file changes without writing

```bash
npx @shidesheng0218/repo-ready@latest fix --dry-run
```

### Apply only safe automatic fixes

```bash
npx @shidesheng0218/repo-ready@latest fix --apply-safe
```

### Write generated fixes

```bash
npx @shidesheng0218/repo-ready@latest fix --write
```

### Create a local fix branch

```bash
npx @shidesheng0218/repo-ready@latest fix --branch
```

### Create a GitHub PR

```bash
npx @shidesheng0218/repo-ready@latest fix --pr --base main
```

`fix --pr` requires:

- a git repository
- a remote named `origin`
- GitHub CLI installed
- GitHub CLI authenticated with `gh auth login`

---

## What RepoReady Can Generate

RepoReady can generate reviewable fixes for:

- `AGENTS.md`
- README install / usage / test / contributing sections
- `.github/workflows/repoready.yml`
- issue template
- PR template
- `.gitignore`
- `.env.example`
- RepoReady badge
- agent-oriented task recommendations

Fixes are grouped into:

| Group | Meaning |
|---|---|
| Safe automatic fixes | Low-risk files such as `AGENTS.md`, `.gitignore`, `.env.example` |
| Review-required fixes | README, CI, templates, workflow changes |
| Manual-only boundaries | database, auth, payment, deployment, secrets, destructive scripts |

---

## Safety Principles

RepoReady is conservative by default.

- It does **not** execute repository scripts.
- It does **not** upload local private source code by default.
- It does **not** write files unless you explicitly request it.
- It does **not** merge PRs automatically.
- It flags dangerous scripts but does not run or rewrite them automatically.
- It treats deployment, database, payment, auth, and secrets as manual-review areas.

---

## Optional AI Enhancement

RepoReady works offline with a rules engine.

No API key means:

```text
No AI call.
No AI cost.
No source upload to AI providers.
```

Optional AI enhancement can be enabled by users who provide their own API key.

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export REPOREADY_AI_KEY="openai:sk-..."
export REPOREADY_AI_MODEL="gpt-4o-mini"
```

Privacy principle:

> AI enhancement should use structured analysis results by default, not the full repository source code.

Cost principle:

> Users pay their own model provider. RepoReady does not create AI cost unless the user explicitly configures AI.

---

## Agent Ready Spec

Print the repository standard that RepoReady uses:

```bash
npx @shidesheng0218/repo-ready@latest spec
npx @shidesheng0218/repo-ready@latest spec --lang zh
```

See also:

```text
docs/agent-ready-spec.md
```

The spec defines what it means for a repository to be ready for AI coding agents.

---

## Policy Layer

Generate a default policy:

```bash
npx @shidesheng0218/repo-ready@latest policy init
```

Write it to `.repoready/policy.yml`:

```bash
npx @shidesheng0218/repo-ready@latest policy init --write
```

Check the current repository against the policy:

```bash
npx @shidesheng0218/repo-ready@latest policy check
npx @shidesheng0218/repo-ready@latest policy check --lang zh
```

The policy layer is designed for teams that want enforceable rules before AI agents modify code.

---

## Agent Workflow Helpers

### Doctor mode

```bash
npx @shidesheng0218/repo-ready@latest doctor
```

### Agent tasks

```bash
npx @shidesheng0218/repo-ready@latest tasks
```

### Context pack preview

```bash
npx @shidesheng0218/repo-ready@latest context --dry-run
```

### Write context files

```bash
npx @shidesheng0218/repo-ready@latest context --write
```

---

## GitHub Action

Example workflow:

```yaml
name: RepoReady

on:
  pull_request:
  push:

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

The GitHub Action can generate a RepoReady summary for pull requests and pushes.

---

## Web Reports

RepoReady also includes a web report direction for public GitHub repositories.

Target experience:

```text
Paste GitHub URL
→ Scan repository
→ See public readiness report
→ Share badge / card
→ Create reviewable Fix PR
```

Example routes:

```text
/r/[owner]/[repo]
/index
/badge/[owner]/[repo].svg
/share-card/[owner]/[repo].svg
```

The web experience is designed for public sharing and GitHub star growth.

---

## Agent Ready Index

RepoReady can generate an index-style Markdown report for multiple repositories.

```bash
npm run index:article
```

The generated article can include:

- executive summary
- key findings
- top agent-ready repositories
- common blockers
- failure risk distribution
- missing `AGENTS.md` ratio
- missing test command ratio
- dangerous scripts count
- methodology
- Chinese summary
- launch copy for Hacker News, Reddit, X, V2EX, Juejin, and Zhihu

---

## Cross-platform Support

RepoReady supports:

- macOS
- Windows
- Linux

Requirements:

```text
Node.js >= 20
npm / npx
```

Windows users should prefer:

```powershell
npx.cmd @shidesheng0218/repo-ready@latest
```

instead of:

```powershell
npx @shidesheng0218/repo-ready@latest
```

because PowerShell may block `npx.ps1` depending on execution policy.

---

## Local Development

Clone the repository:

```bash
git clone https://github.com/shidesheng0218/repo-ready.git
cd repo-ready
```

Run locally:

```bash
node packages/cli/bin/repoready.js
node packages/cli/bin/repoready.js --lang zh
node packages/cli/bin/repoready.js fix --dry-run
```

Windows:

```powershell
cd D:\Github项目\repoready
node packages\cli\bin\repoready.js
node packages\cli\bin\repoready.js --lang zh
node packages\cli\bin\repoready.js fix --dry-run
```

Run tests:

```bash
node --test
npm run lint
```

Windows:

```powershell
node --test
npm.cmd run lint
```

Pack locally:

```bash
npm pack --dry-run
```

Windows:

```powershell
npm.cmd pack --dry-run
```

---

## Project Structure

```text
packages/core
  scanning, scoring, reports, policy, spec, fix generation

packages/cli
  local CLI, report output, fix workflow, PR workflow

packages/action
  GitHub Action wrapper

apps/web
  public report page, badge, share card, Fix PR flow

docs
  Agent Ready Spec, Agent Ready Index, methodology docs

scripts
  index scanning and report generation scripts
```

---

## Roadmap

### Completed

- [x] Local repository scanner
- [x] Public GitHub repository scan path
- [x] English and Chinese CLI reports
- [x] JSON and Markdown outputs
- [x] Evidence chain and score breakdown
- [x] Code Quality Score
- [x] Agent Failure Risk
- [x] Strategy Layer 2.0
- [x] Agent Ready Spec
- [x] Policy init/check
- [x] Doctor, tasks, and context commands
- [x] Fix plan and safe-fix classification
- [x] Fix dry-run/write/branch/PR prototype
- [x] GitHub Action wrapper
- [x] Public report page MVP
- [x] Badge and share-card routes
- [x] GitHub App Fix PR MVP with patch-preview fallback
- [x] Agent Ready Index MVP
- [x] Chinese encoding hardening

### Next

- [ ] More language-specific rules
- [ ] Better framework detection
- [ ] Organization dashboard
- [ ] Repository trend history
- [ ] Enterprise policy packs
- [ ] Deeper GitHub App permission flow
- [ ] More professional web report design
- [ ] Public Agent Ready Index with real repository dataset

---

## Why This Matters

AI coding agents are becoming part of everyday software development.

But many repositories are not ready for them.

Agents fail when:

- instructions are missing
- tests are unclear
- README is weak
- generated files pollute context
- dangerous scripts are not marked
- project boundaries are not documented
- validation commands are missing

RepoReady helps turn those hidden risks into visible, explainable, fixable signals.

中文一句话：

> RepoReady 帮你把仓库整理成 AI 编程代理和真人贡献者都更容易理解、更容易验证、更安全协作的状态。

---

## Links

- GitHub: https://github.com/shidesheng0218/repo-ready
- npm: https://www.npmjs.com/package/@shidesheng0218/repo-ready

---

## License

MIT
