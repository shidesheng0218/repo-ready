# Contributing to RepoReady

Thanks for helping improve RepoReady.

RepoReady is a CLI-first tool for checking whether repositories are ready for AI coding agents such as Codex, Claude Code, and Cursor.

## Good first issues

Good areas to start:

- Add Python framework detection rules
- Add Rust readiness checks
- Add Go project detection
- Improve dangerous script detection
- Improve README scoring for non-English projects

## Development

```bash
git clone https://github.com/shidesheng0218/repo-ready.git
cd repo-ready
npm install
```

Run the CLI locally:

```bash
node packages/cli/bin/repoready.js
node packages/cli/bin/repoready.js --compact
node packages/cli/bin/repoready.js --lang zh
```

Run checks:

```bash
npm run lint
node --test
```

## Contribution guidelines

- Keep the CLI useful without requiring a server.
- Do not execute repository scripts during scans.
- Keep user-facing output bilingual when applicable.
- Add tests for new rules.
- Prefer clear evidence over opaque scoring.
- Treat deployment, database, auth, payment, secrets, and destructive scripts as manual-review areas.

## Pull requests

Please include:

- What changed
- Why it matters for AI-agent readiness
- Tests run
- Screenshots or CLI output if user-facing output changed
