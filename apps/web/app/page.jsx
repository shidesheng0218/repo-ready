
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
              <h1>Make every repository <span className="gradient-text">ready for agents</span>.</h1>
              <p>
                RepoReady is the preflight layer for AI coding agents. It turns repository readiness into a public report, a fix plan, and a reviewable pull request.
              </p>
              <form action={scan} className="scan-form">
                <input className="input" name="repo" placeholder="https://github.com/vercel/next.js" aria-label="GitHub repository URL" />
                <button className="btn btn-primary" type="submit">Scan repository</button>
              </form>
              <p style={{ fontSize: 14, color: "var(--faint)" }}>
                Built for Codex, Claude Code, Cursor, Copilot-style agents, and human contributors.
              </p>
            </div>
            <div className="panel hero-card">
              <div className="terminal">
                <div className="terminal-bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                <pre>{`$ npx @shidesheng0218/repo-ready@latest

RepoReady Report - your-repo
Overall Score        91/100
Agent Ready          94/100
Contributor Ready    88/100
Context Quality      96/100
Safety               100/100

Evidence
+ AGENTS.md detected
+ Test command detected
+ GitHub Actions workflow detected
+ No dangerous scripts

Strategy
1. Keep agent context clean
2. Add reviewable Fix PR
3. Publish the report badge`}</pre>
              </div>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="section-head">
            <h2>From scanner to readiness infrastructure.</h2>
            <p className="section-lead">RepoReady does not stop at scores. It explains the evidence, prioritizes strategy, generates safe fixes, and helps maintainers show progress publicly.</p>
          </div>
          <div className="grid-3">
            <Feature title="Public reports" text="Share polished readiness reports at /r/owner/repo with evidence, strategy, badges, and social cards." />
            <Feature title="Fix PR workflow" text="Turn missing AGENTS.md, README guidance, CI, templates, and safety notes into reviewable pull requests." />
            <Feature title="Agent Ready Index" text="Collect readiness data across public repositories and turn it into benchmarks, articles, and launch stories." />
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
                <li>Safety boundaries: destructive scripts, secrets, deploy risks</li>
              </ul>
            </div>
            <div className="panel" style={{ padding: 28 }}>
              <h2 style={{ marginBottom: 18 }}>What strategy adds</h2>
              <ul className="list">
                <li>Impact-first priority instead of a flat checklist</li>
                <li>Safe automation separated from review-required work</li>
                <li>Growth advice for badges, reports, and launch copy</li>
                <li>Policy posture for teams using AI coding agents</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="panel" style={{ padding: 34, textAlign: "center" }}>
            <h2>Run one scan. Get a shareable artifact.</h2>
            <p className="section-lead" style={{ margin: "12px auto 24px" }}>No AI API key required. No repository scripts executed. Public web scans only read the files needed for readiness analysis.</p>
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
  return <footer className="footer"><div className="shell">RepoReady - AI Agent Readiness for GitHub repositories - MIT</div></footer>;
}
