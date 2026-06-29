import { redirect } from "next/navigation";

export default function Home() {
  async function scan(formData) {
    "use server";
    const repo = String(formData.get("repo") || "").trim();
    const match = repo.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)|^([^/\s]+)\/([^/\s]+)$/i);
    if (!match) redirect("/?error=invalid");
    const owner = match[1] || match[3];
    const name = (match[2] || match[4]).replace(/\.git$/, "");
    redirect(`/r/${owner}/${name}`);
  }

  return (
    <>
      <Nav />
      <main>
        <section className="hero shell">
          <div className="hero-grid">
            <div>
              <h1>Make every repo <span className="gradient-text">agent ready</span>.</h1>
              <p>
                RepoReady checks whether a GitHub repository is understandable, testable, safe, and actionable for Codex, Claude Code, Cursor, and human contributors.
              </p>
              <form action={scan} className="scan-form">
                <input className="input" name="repo" placeholder="https://github.com/vercel/next.js" aria-label="GitHub repository URL" />
                <button className="btn btn-primary" type="submit">Scan repo</button>
              </form>
              <p style={{ fontSize: 14, color: "var(--faint)" }}>
                中文：让你的仓库更适合 AI 编程代理协作，也更容易被贡献者理解。
              </p>
            </div>
            <div className="panel hero-card">
              <div className="terminal">
                <div className="terminal-bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                <pre>{`$ npx @shidesheng0218/repo-ready@latest

RepoReady Report · your-repo
Overall Score        91/100
Agent Ready          94/100
Contributor Ready    88/100
Context Quality      96/100
Safety               100/100

Evidence
✓ AGENTS.md detected
✓ Test command detected
✓ GitHub Actions workflow detected
✓ No dangerous scripts

Next step
→ Create Fix PR`}</pre>
              </div>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="section-head">
            <h2>The preflight layer for AI coding agents.</h2>
            <p className="section-lead">Before an agent changes code, RepoReady checks whether the repository has the instructions, commands, context, and safety boundaries it needs.</p>
          </div>
          <div className="grid-3">
            <Feature title="Public report pages" text="Generate shareable reports at /r/owner/repo with evidence, scores, badges, and social cards." />
            <Feature title="One-click Fix PR" text="Create reviewable PRs for AGENTS.md, README guidance, CI, templates, and safe repository hygiene." />
            <Feature title="Agent Ready Index" text="Track which open-source projects are ready for AI agents and turn the data into viral research reports." />
          </div>
        </section>

        <section className="section shell">
          <div className="grid-2">
            <div className="panel" style={{ padding: 28 }}>
              <h2 style={{ marginBottom: 18 }}>What gets measured</h2>
              <ul className="list">
                <li>Agent instructions: AGENTS.md, CLAUDE.md, Cursor rules</li>
                <li>Validation commands: install, test, build, lint/check</li>
                <li>Contributor onboarding: README, usage, contribution path</li>
                <li>Context quality: generated files, caches, large files</li>
                <li>Safety boundaries: dangerous scripts, env files, deploy risks</li>
              </ul>
            </div>
            <div className="panel" style={{ padding: 28 }}>
              <h2 style={{ marginBottom: 18 }}>Why it spreads</h2>
              <ul className="list">
                <li>Developers can share a score and badge.</li>
                <li>Maintainers get a concrete Fix PR, not just criticism.</li>
                <li>Teams get policy checks before AI agents touch code.</li>
                <li>The ecosystem gets an Agent Ready Index.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="panel" style={{ padding: 34, textAlign: "center" }}>
            <h2>Start with one public repository.</h2>
            <p className="section-lead" style={{ margin: "12px auto 24px" }}>No AI API key required. No source upload from local scans. No repository scripts executed.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a className="btn btn-primary" href="https://github.com/shidesheng0218/repo-ready">Star on GitHub</a>
              <a className="btn btn-secondary" href="/index">View Agent Ready Index</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Feature({ title, text }) {
  return <div className="card"><h3>{title}</h3><p>{text}</p></div>;
}

function Nav() {
  return (
    <header className="shell nav">
      <a className="brand" href="/"><span className="brand-mark" />RepoReady</a>
      <nav className="nav-links">
        <a href="/index">Index</a>
        <a href="https://www.npmjs.com/package/@shidesheng0218/repo-ready">npm</a>
        <a href="https://github.com/shidesheng0218/repo-ready">GitHub</a>
      </nav>
    </header>
  );
}

function Footer() {
  return <footer className="footer"><div className="shell">RepoReady · AI Agent Readiness for GitHub repositories · MIT</div></footer>;
}
