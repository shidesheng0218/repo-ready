# RepoReady Launch Pack

RepoReady is a CLI-first tool for checking whether a repository is ready for Codex, Claude Code, Cursor, and contributors.

Core command:

```bash
npx @shidesheng0218/repo-ready@latest
```

## Short descriptions

### English

RepoReady checks whether your repository is ready for AI coding agents such as Codex, Claude Code, and Cursor. It detects missing agent instructions, validation gaps, README issues, context noise, dangerous scripts, and PR-ready fixes.

### 中文

RepoReady 是一个 AI 编程代理仓库体检工具。一行命令检查你的仓库是否适合 Codex、Claude Code、Cursor 修改，并输出失败风险、证据链和可生成的修复计划。

## 30-second pitch

AI coding agents do not fail only because the model is weak. They often fail because the repository is hard to understand: no agent instructions, missing test commands, unclear README, noisy context, and unsafe scripts.

RepoReady is a CLI that scans those signals and shows an agent-readiness report. It also generates a reviewable fix plan for `AGENTS.md`, README sections, CI, templates, `.gitignore`, and `.env.example`.

Run:

```bash
npx @shidesheng0218/repo-ready@latest
```

中文 30 秒介绍：

```text
我做了一个开源 CLI 工具 RepoReady。
它可以一行命令检查你的 GitHub 仓库是否适合 Codex / Claude Code / Cursor 这类 AI 编程代理修改。
它不会执行仓库脚本，也不需要 AI API key。它主要检查 AGENTS.md、测试命令、README、上下文噪音、危险脚本，并生成可审查的修复计划。
```

## GitHub Release v0.6.0

Title:

```text
RepoReady v0.6.0 - CLI-first launch pack for AI coding agent readiness
```

Body:

```md
RepoReady v0.6.0 focuses on making the project easier to understand, run, screenshot, and share.

## Highlights

- CLI-first README for GitHub and npm discovery
- Screenshot-friendly report output with `--compact` and `--screenshot`
- Clean Agent Failure Risk, Evidence Chain, and Fix PR Plan sections
- Launch pack for V2EX, Reddit, Hacker News, X, 掘金, and 小红书
- Marketing assets for community posts
- Contributor templates and Good First Issue ideas
- README encoding cleanup

Run:

```bash
npx @shidesheng0218/repo-ready@latest
```

Chinese report:

```bash
npx @shidesheng0218/repo-ready@latest --lang zh
```

Fix preview:

```bash
npx @shidesheng0218/repo-ready@latest fix --dry-run
```
```

## V2EX

Node suggestions:

```text
分享创造
程序员
开源软件
AI
GitHub
Node.js
```

Title:

```text
做了一个 AI 编程代理仓库体检工具：一行命令检查仓库是否适合 Codex / Claude Code / Cursor
```

Post:

```text
最近用 Codex / Claude Code / Cursor 改项目时，我发现一个问题：很多仓库本身并不适合 AI agent 理解。

常见问题包括：
- 没有 AGENTS.md / CLAUDE.md / Cursor rules
- README 没写清安装、运行、测试
- 没有 test/build/lint 命令
- 仓库里有生成物、缓存、大文件，干扰上下文
- package scripts 里有危险命令，比如数据库重置、生产部署、强推

所以我做了 RepoReady：

```bash
npx @shidesheng0218/repo-ready@latest
```

它会输出：
- Agent Failure Risk
- Evidence Chain
- Safety Score
- PR-ready Fixes
- fix --dry-run patch

GitHub:
https://github.com/shidesheng0218/repo-ready

npm:
https://www.npmjs.com/package/@shidesheng0218/repo-ready

欢迎试用和提 issue。
```

## Hacker News

Title:

```text
Show HN: RepoReady - Check if your repo is ready for AI coding agents
```

Post:

```text
I built RepoReady, a CLI that checks whether a repository is ready for AI coding agents such as Codex, Claude Code, and Cursor.

It scans for missing agent instructions, validation commands, README gaps, context noise, dangerous scripts, and PR-ready fixes.

Run:

npx @shidesheng0218/repo-ready@latest

GitHub:
https://github.com/shidesheng0218/repo-ready

I built it because agent failures are often caused by repository structure and missing validation signals, not only by the model.
```

## Reddit

Suggested subreddits:

```text
r/opensource
r/github
r/programming
r/webdev
r/javascript
r/typescript
r/ClaudeAI
r/cursor
r/ChatGPTCoding
```

Title:

```text
I built a CLI to check if a repo is ready for Codex, Claude Code, and Cursor
```

Body:

```text
I built RepoReady, an open-source CLI that scans a repository for AI coding agent readiness.

It checks:
- AGENTS.md / CLAUDE.md / Cursor rules
- test/build/lint commands
- README onboarding quality
- context noise and ignored files
- dangerous scripts
- PR-ready fixes

Run:

npx @shidesheng0218/repo-ready@latest

Repo:
https://github.com/shidesheng0218/repo-ready

Would love feedback from people using coding agents on real projects.
```

## X / Twitter

```text
I built RepoReady - a CLI that checks whether your repo is ready for Codex, Claude Code, Cursor, and contributors.

Run:
npx @shidesheng0218/repo-ready@latest

It checks agent instructions, validation commands, README quality, context noise, dangerous scripts, and PR-ready fixes.

GitHub:
https://github.com/shidesheng0218/repo-ready
```

## 掘金文章大纲

Title:

```text
我做了一个 AI 编程代理仓库体检工具：RepoReady
```

Outline:

```text
1. 为什么 AI agent 经常改错代码
2. 问题不一定在模型，也可能在仓库
3. 什么是 agent-ready repository
4. AGENTS.md / 测试命令 / 安全边界为什么重要
5. RepoReady 怎么扫描
6. 一行命令演示
7. fix --dry-run 如何生成修复建议
8. GitHub 地址和邀请反馈
```

## 知乎问题/回答

Question:

```text
如何让一个 GitHub 仓库更适合 Codex / Claude Code / Cursor 修改？
```

Answer angle:

```text
AI 编程代理要稳定工作，除了模型能力，还依赖仓库本身是否提供足够清晰的上下文、验证命令和安全边界。
我做了一个开源工具 RepoReady，可以一行命令做仓库体检：
npx @shidesheng0218/repo-ready@latest
```

## 小红书

Title:

```text
用 AI 写代码前，先给仓库做一次体检
```

Body:

```text
我做了一个开源小工具 RepoReady。

它可以一行命令检查你的 GitHub 仓库是否适合 Codex / Claude Code / Cursor 这类 AI 编程代理修改。

它会看：
- 有没有 AGENTS.md
- README 是否写清安装 / 运行 / 测试
- 有没有 test / build / lint 命令
- 有没有危险脚本
- 仓库上下文是否太乱
- 能不能生成修复计划

命令：
npx @shidesheng0218/repo-ready@latest

适合经常用 AI 写代码、维护开源项目，或者想让项目更容易被贡献的人。
```

Image suggestions:

```text
1. launch-cli-hero.png：主封面
2. launch-cli-zh.png：中文 CLI 报告
3. launch-fix-plan.png：修复计划
4. launch-before-after.png：改造前后对比
```

## Good First Issue copy

Use these as GitHub issues:

```text
Add Python framework detection rules
Add Rust readiness checks
Add Go project detection
Improve dangerous script detection
Improve README scoring for non-English projects
```

Each issue should include:

```md
## Goal

Improve RepoReady's readiness checks for this ecosystem or signal.

## Suggested implementation

- Add fixture repository structure under tests.
- Extend detection rules in core.
- Add or update tests.
- Keep output bilingual where user-facing.

## Acceptance criteria

- `npm run lint` passes.
- `node --test` passes.
- The new rule appears in report evidence or score breakdown.
```
