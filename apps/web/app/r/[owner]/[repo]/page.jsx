import { buildFixPlan, renderReport } from "@repoready/core";
import FixPrButton from "../../../components/FixPrButton";
import { buildReportLinks, buildSocialCopy, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { owner, repo } = params;
  return {
    title: `${owner}/${repo} · RepoReady Report`,
    description: `AI Agent Readiness report for ${owner}/${repo}`,
    openGraph: {
      title: `${owner}/${repo} · RepoReady`,
      description: "AI Agent Readiness report for Codex, Claude Code, Cursor, and contributors.",
      images: [`/share-card/${owner}/${repo}.svg`]
    }
  };
}

export default async function RepoReportPage({ params, searchParams }) {
  const { owner, repo } = params;
  const installationId = searchParams?.installation_id;
  let report;
  let error = null;
  try {
    report = await scanRepoCached({ owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` });
  } catch (e) {
    error = e.message;
  }

  return (
    <>
      <header className="shell nav">
        <a className="brand" href="/"><span className="brand-mark" />RepoReady</a>
        <nav className="nav-links"><a href="/index">Index</a><a href={`https://github.com/${owner}/${repo}`}>GitHub</a></nav>
      </header>
      <main className="shell section">
        {error ? <ErrorView owner={owner} repo={repo} error={error} /> : <ReportView report={report} installationId={installationId} />}
      </main>
    </>
  );
}

function ErrorView({ owner, repo, error }) {
  return <section className="panel" style={{ padding: 28 }}><h1>Scan failed</h1><p className="error">{error}</p><a className="btn btn-secondary" href={`https://github.com/${owner}/${repo}`}>Open on GitHub</a></section>;
}

function ReportView({ report, installationId }) {
  const links = buildReportLinks(report);
  const copy = buildSocialCopy(report);
  const plan = buildFixPlan(report);
  const metrics = [
    ["Overall", report.scores.overall],
    ["Agent Ready", report.scores.agentReady],
    ["Contributor", report.scores.contributorReady],
    ["Context", report.scores.contextQuality],
    ["Safety", report.scores.safety],
    ["Code Quality", report.scores.codeQuality]
  ];

  return (
    <>
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)", gap: 18, alignItems: "start" }}>
        <div className="panel" style={{ padding: 30 }}>
          <div className="badge">PUBLIC REPORT · {report.cached ? "CACHED" : "FRESH SCAN"}</div>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 76px)", letterSpacing: "-.07em", lineHeight: .95, margin: "18px 0 16px" }}>{report.repository.fullName || report.repository.name}</h1>
          <p className="section-lead">AI Agent Readiness report for Codex, Claude Code, Cursor, and contributors. Generated from repository evidence, not vibes.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
            <a className="btn btn-secondary" href={links.githubUrl}>Open GitHub</a>
            <a className="btn btn-secondary" href={links.shareCardUrl}>Share Card</a>
            <a className="btn btn-secondary" href={links.badgeUrl}>Badge SVG</a>
          </div>
        </div>
        <div className="panel" style={{ padding: 24 }}>
          <div className="metric-label">Overall score</div>
          <div className="metric-value gradient-text">{report.scores.overall}</div>
          <div className="progress"><span style={{ width: `${report.scores.overall}%` }} /></div>
          <p className="muted">Ready score across agent instructions, contributor onboarding, clean context, safety, and code quality.</p>
        </div>
      </section>

      <section className="section">
        <div className="grid-3">
          {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
        </div>
      </section>

      <section className="grid-2">
        <Panel title="Evidence chain">
          <ul className="list">{(report.evidence || []).slice(0, 8).map((item) => <li key={item.en || item.zh}>{item.en || item.zh}</li>)}</ul>
        </Panel>
        <Panel title="Create a Fix PR">
          <p className="muted">RepoReady can turn the report into a reviewable pull request. If the GitHub App is not installed, you still get a patch preview.</p>
          <FixPrButton repo={links.githubUrl} installationId={installationId} />
        </Panel>
      </section>

      <section className="section grid-2">
        <Panel title="Top issues"><List items={report.issues.slice(0, 7).map((i) => `${i.severity.toUpperCase()} · ${i.title}`)} empty="No major issues detected." /></Panel>
        <Panel title="Fix plan"><List items={[`Safe automatic fixes: ${plan.safe.length}`, `Needs review: ${plan.review.length}`, `Manual only: ${plan.manual.length}`, ...[...plan.safe, ...plan.review].slice(0, 5).map((c) => c.path)]} /></Panel>
      </section>

      <section className="grid-2">
        <Panel title="README badge">
          <pre className="code">{`[![RepoReady](${links.badgeUrl})](${links.publicUrl})`}</pre>
        </Panel>
        <Panel title="Social copy">
          <pre className="code">{copy.x}{"\n\n"}{copy.zh}</pre>
        </Panel>
      </section>

      <section className="section">
        <Panel title="Share card">
          <img alt="RepoReady share card" src={links.shareCardUrl} style={{ width: "100%", borderRadius: 20, border: "1px solid var(--line)" }} />
        </Panel>
      </section>

      <section className="section">
        <Panel title="Markdown report">
          <pre className="code" style={{ maxHeight: 520 }}>{renderReport(report, { format: "markdown", lang: "en" })}</pre>
        </Panel>
      </section>
    </>
  );
}

function Metric({ label, value }) {
  return <div className="card metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}
function Panel({ title, children }) { return <section className="panel" style={{ padding: 24 }}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
function List({ items, empty }) { return items?.length ? <ul className="list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty || "No items."}</p>; }
