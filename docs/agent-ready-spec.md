# Agent Ready Repository Standard

RepoReady defines an **Agent Ready Repository** as a repository that is understandable, testable, safe, and actionable for AI coding agents such as Codex, Claude Code, Cursor, Copilot-style agents, and similar tools.

RepoReady 把 **Agent Ready Repository / AI 代理友好仓库** 定义为：AI 编程代理能够快速理解、可验证修改、知道安全边界、并能把工作拆成可审查任务的仓库。

## 1. Agent instructions / 代理协作说明

An agent-ready repository should include:

- `AGENTS.md` with project structure, commands, coding rules, and safety boundaries.
- Optional agent-specific files such as `CLAUDE.md` and `.cursor/rules`.
- Clear guidance for small, reviewable changes.

一个 AI 代理友好仓库应该包含：

- `AGENTS.md`：说明项目结构、常用命令、编码规范和安全边界。
- 可选的 agent 专用文件，例如 `CLAUDE.md`、`.cursor/rules`。
- 鼓励小步、可审查、可验证的修改方式。

## 2. Required commands / 必备命令

The repository should document or expose:

- install command
- development command
- test command
- build command
- lint/check command

Agents should be able to validate changes without guessing.

仓库应该明确提供安装、开发、测试、构建、检查命令，让 AI agent 不需要猜测如何验证修改。

## 3. README onboarding / README 上手路径

The README should include:

- project description
- installation
- usage
- testing
- contribution guidance
- license/status badges where useful

README 应该让新人和 AI agent 都能快速知道：项目是什么、怎么安装、怎么使用、怎么测试、如何贡献。

## 4. Safety boundaries / 安全边界

AI agents should not run or modify high-risk areas without explicit review:

- destructive delete commands
- forced pushes
- production deploys
- database resets or migrations
- authentication, payment, secrets, and infrastructure code

AI agent 不应该在没有明确授权的情况下执行或修改高风险内容，例如删除、强推、生产部署、数据库重置、认证、支付、密钥和基础设施配置。

## 5. Context quality / 上下文质量

The repository should keep agent context clean:

- ignore generated files and caches
- avoid committing large artifacts
- provide `.env.example`
- avoid committing real `.env` files

仓库应该保持上下文干净：忽略生成物和缓存，避免提交大文件，提供 `.env.example`，不要提交真实 `.env`。

## 6. Agent task readiness / 任务可执行性

Good AI-agent tasks are:

- small
- explicit
- scoped to known files
- paired with validation commands
- safe to review as pull requests

好的 AI agent 任务应该足够小、足够明确、有清楚的文件范围、有验证命令，并适合通过 PR 审查。

## 7. Policy compliance / 策略合规

Teams can use RepoReady policy checks to enforce baseline requirements before AI agents touch a repository:

```bash
npx @shidesheng0218/repo-ready@latest policy init --write
npx @shidesheng0218/repo-ready@latest policy check
```

团队可以用 RepoReady 的策略检查，把“AI agent 修改代码前的最低标准”变成可执行规则。
