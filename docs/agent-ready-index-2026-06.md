# Agent Ready Index 2026-06

## Executive summary

RepoReady scanned **1 public GitHub repositories** for AI coding agent readiness: whether a repository is clear, safe, validated, and easy for Codex, Claude Code, Cursor, and contributors to work with.

Average scores:

- Overall RepoReady score: **92/100**
- Agent Ready: **95/100**
- Contributor Ready: **88/100**
- Context Quality: **90/100**
- Safety: **100/100**

## Key findings

- **0 repositories (0%)** are missing agent instructions such as AGENTS.md, CLAUDE.md, or Cursor rules.
- **0 repositories (0%)** are missing a detected test command.
- **0 repositories (0%)** contain potentially dangerous scripts.
- The most common blocker is **Missing agent instructions**.

## Top 10 Agent-Ready repositories

| Rank | Repository | Overall | Agent Ready | Contributor | Safety |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | [shidesheng0218/repo-ready](https://github.com/shidesheng0218/repo-ready) | 92 | 95 | 88 | 100 |

## Most common blockers

| Blocker | Count | Ratio | Why it matters |
| --- | ---: | ---: | --- |
| Missing agent instructions | 0 | 0% | Agents must infer repository structure and boundaries. |
| Missing test command | 0 | 0% | Agents cannot prove changes work. |
| Dangerous scripts | 0 | 0% | Agents need explicit human-approval boundaries. |
| Context quality below 70 | 0 | 0% | Generated files or noisy context can confuse agents. |
| Contributor readiness below 70 | 0 | 0% | Humans and agents both need clear onboarding. |

## Failure risk distribution

| Failure risk | Count | Ratio | Signal |
| --- | ---: | ---: | --- |
| Scope drift | 0 | 0% | Missing AGENTS.md / CLAUDE.md / Cursor rules |
| Validation gap | 0 | 0% | Missing test command |
| Safety boundary | 0 | 0% | Dangerous scripts detected |
| Context confusion | 0 | 0% | Low context quality score |
| Onboarding gap | 0 | 0% | Low contributor readiness score |

## Metric ratios

- Missing AGENTS.md / agent instruction ratio: **0%**
- Missing test command ratio: **0%**
- Dangerous scripts count: **0**

## Methodology

RepoReady uses static analysis only. It checks agent instruction files, validation commands, README onboarding, context quality, safety boundaries, GitHub Actions, and code-quality signals. It does **not** execute repository scripts and does **not** upload private local source by default.

## ????

RepoReady ??? **1 ??? GitHub ??**????????? Codex?Claude Code?Cursor ? AI ?????????????? AGENTS.md ??? agent ?????????????????????????RepoReady ????????????????????????????? AI ?????????

## Launch copy

### Hacker News

Show HN: RepoReady Agent Ready Index ? we scanned 1 repos for AI coding agent readiness

### Reddit

I built RepoReady and used it to scan 1 public GitHub repositories for AI coding agent readiness: AGENTS.md, validation commands, README onboarding, context noise, and safety boundaries.

### X

We scanned 1 GitHub repositories for AI coding agent readiness. Missing AGENTS.md: 0%. Missing test command: 0%. Dangerous scripts: 0.

RepoReady Agent Ready Index 2026-06

### V2EX

????? RepoReady ????? GitHub ??????????? AI ??????

### ?? / ??

???AI ???????????????? RepoReady ???? Agent Ready Index
