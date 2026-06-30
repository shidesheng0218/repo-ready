import { redirect } from "next/navigation";

const EXAMPLE_REPO = "https://github.com/shidesheng0218/repo-ready";

function parseRepo(value) {
  const repo = String(value || "").trim();
  const match = repo.match(/github\.com[/:]([^/\s]+)\/([^/\s#?]+)|^([^/\s]+)\/([^/\s]+)$/i);
  if (!match) return null;
  const owner = match[1] || match[3];
  const name = (match[2] || match[4]).replace(/\.git$/, "");
  return { owner, name };
}

export default async function Home({ searchParams }) {
  const query = await searchParams;
  const quickRepo = parseRepo(query?.repo);
  if (quickRepo) redirect(`/r/${quickRepo.owner}/${quickRepo.name}`);
  const hasInvalidError = query?.error === "invalid";

  async function scan(formData) {
    "use server";
    const parsed = parseRepo(formData.get("repo"));
    if (!parsed) redirect("/?error=invalid");
    redirect(`/r/${parsed.owner}/${parsed.name}`);
  }

  return (
    <>
      <Nav />
      <main>
        <section className="home-hero shell">
          <div className="home-hero-copy">
            <div className="trust-row">
              <span>No AI API required</span>
              <span>No scripts executed</span>
              <span>Public repos only</span>
            </div>
            <h1>Make your repo ready for AI coding agents.</h1>
            <p>
              RepoReady turns a GitHub repository into a clear readiness audit for Codex, Claude Code,
              Cursor, contributors, and safe Fix PRs.
            </p>
            <form action={scan} className="scan-form premium-form">
              <input
                className="input"
                name="repo"
                placeholder={EXAMPLE_REPO}
                aria-label="GitHub repository URL"
              />
              <button className="btn btn-primary" type="submit">Scan repository</button>
            </form>
            {hasInvalidError && (
              <div className="home-error">
                Please enter a valid GitHub repository URL, for example <code>{EXAMPLE_REPO}</code> or <code>shidesheng0218/repo-ready</code>.
              </div>
            )}
            <div className="hero-links">
              <a className="btn btn-secondary" href="https://github.com/shidesheng0218/repo-ready">Star on GitHub</a>
              <a className="btn btn-ghost" href="https://www.npmjs.com/package/@shidesheng0218/repo-ready">View npm</a>
            </div>
          </div>
          <div className="proof-stack">
            <TerminalProof />
            <div className="proof-note">
              <strong>Windows:</strong> <code>npx.cmd @shidesheng0218/repo-ready@latest</code>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="center-head">
            <p className="eyebrow">Product flow</p>
            <h2>From a URL to a reviewable Fix PR.</h2>
            <p className="section-lead">
              RepoReady is designed as a visible workflow, not just a local score.
            </p>
          </div>
          <div className="flow-grid">
            <FlowStep number="1" title="Paste GitHub URL" text="Start from any public repository URL or owner/repo shorthand." />
            <FlowStep number="2" title="Scan readiness" text="Detect instructions, validation commands, context noise, and safety boundaries." />
            <FlowStep number="3" title="Review evidence" text="See why agents may fail and which fixes are safe or review-required." />
            <FlowStep number="4" title="Create Fix PR" text="Open a professional PR or copy a patch when app access is unavailable." />
          </div>
        </section>

        <section className="section shell">
          <div className="split-head">
            <div>
              <p className="eyebrow">Core platform</p>
              <h2>Audit signals built for AI-agent collaboration.</h2>
            </div>
            <p className="section-lead">
              Every score is backed by evidence, risk reasoning, and a fix path that maintainers can actually review.
            </p>
          </div>
          <div className="capability-grid">
            <Capability title="Agent Failure Risk" text="Predicts validation gaps, scope drift, onboarding gaps, context confusion, and safety boundary issues." />
            <Capability title="Audit Evidence Chain" text="Shows where each signal came from, why it matters, and how it affects repository readiness." />
            <Capability title="Explainable Fix PR" text="Turns missing instructions, README gaps, templates, and workflows into reviewable changes." />
            <Capability title="Shareable Reports" text="Creates public report pages, badges, and social cards that make readiness visible." />
            <Capability title="Agent Ready Index" text="Collects readiness data across repositories and turns it into launchable research content." />
            <Capability title="Safety Boundaries" text="Keeps secrets, deployment, auth, payment, database, and destructive scripts manual-only." />
          </div>
        </section>

        <section className="section shell">
          <div className="fix-showcase panel">
            <div>
              <p className="eyebrow">The GitHub-native loop</p>
              <h2>RepoReady generated a reviewable PR.</h2>
              <p className="section-lead">
                The real product moment is not the score. It is a PR that explains why it exists,
                what it detected, what changed, and what humans still need to review.
              </p>
              <div className="mini-checks">
                <span>Safe fixes grouped</span>
                <span>Review-required changes marked</span>
                <span>Manual-only boundaries preserved</span>
              </div>
            </div>
            <div className="pr-card">
              <div className="pr-card-head">
                <span className="pr-dot" />
                <strong>Make repository AI-agent ready with RepoReady</strong>
              </div>
              <div className="pr-body-preview">
                <p>## Why this PR exists</p>
                <p>## What RepoReady detected</p>
                <p>## Agent Failure Risks</p>
                <p>## What this PR changes</p>
                <p>## Validation</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="bottom-cta">
            <p className="eyebrow">Run your first scan</p>
            <h2>One command. One report. One fix path.</h2>
            <pre className="inline-command">npx @shidesheng0218/repo-ready@latest</pre>
            <div className="hero-links center">
              <a className="btn btn-primary" href="/r/shidesheng0218/repo-ready">Try RepoReady</a>
              <a className="btn btn-secondary" href="/index">View Agent Ready Index</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function TerminalProof() {
  return (
    <div className="terminal terminal-premium">
      <div className="terminal-bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
      <pre>{`$ npx @shidesheng0218/repo-ready@latest

RepoReady Report - repo-ready
Overall Score       96/100
Agent Ready         100/100
Safety              100/100

Agent Failure Risk
LOW - Validation Gap - 8/100
LOW - Scope Drift - 4/100

Evidence Chain
PASS - AGENTS.md detected
PASS - Test command detected
PASS - GitHub Actions workflow detected

Fix PR plan
safe: AGENTS.md, .env.example
review: README.md, repoready.yml`}</pre>
    </div>
  );
}

function FlowStep({ number, title, text }) {
  return (
    <article className="flow-step">
      <div className="flow-number">{number}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Capability({ title, text }) {
  return (
    <article className="capability-card">
      <div className="capability-mark" />
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
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
  return <footer className="footer"><div className="shell">RepoReady - AI agent readiness audit and Fix PR workflow - MIT</div></footer>;
}
