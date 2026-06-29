
import { buildFixPlan, renderReport } from "@repoready/core";
import FixPrButton from "../../../components/FixPrButton";
import { buildReportLinks, buildSocialCopy, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} - RepoReady Report`,
    description: `AI Agent Readiness report for ${owner}/${repo}`,
    openGraph: {
      title: `${owner}/${repo} - RepoReady`,
      description: "AI Agent Readiness report for Codex, Claude Code, Cursor, and contributors.",
      images: [`/share-card/${owner}/${repo}.svg`]
    }
  };
}

export default async function RepoReportPage({ params, searchParams }) {
  const { owner, repo } = await params;
  const query = await searchParams;
  const installationId = query?.installation_id;
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
  return <section className="panel" style={{ padding: 30 }}><h1>Scan failed</h1><p className="error">{error}</p><a className="btn btn-secondary" href={`https://github.com/${owner}/${repo}`}>Open on GitHub</a></section>;
}

function ReportView({ report, installationId }) {
  const links = buildReportLinks(report);
  const copy = buildSocialCopy(report);
  const plan = buildFixPlan(report);
  const strategy = report.strategy;
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
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, .65fr)", gap: 18, alignItems: "stretch" }}>
        <div className="panel" style={{ padding: 32 }}>
          <div className="badge">PUBLIC REPORT - {report.cached ? "CACHED" : "FRESH SCAN"}</div>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", letterSpacing: "-.052em", lineHeight: 1, margin: "18px 0 16px" }}>{report.repository.fullName || report.repository.name}</h1>
          <p className="section-lead">A readiness report for AI coding agents and contributors, backed by repository evidence, strategy, and fixability analysis.</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
            <a className="btn btn-secondary" href={links.githubUrl}>Open GitHub</a>
            <a className="btn btn-secondary" href={links.shareCardUrl}>Share Card</a>
            <a className="btn btn-secondary" href={links.badgeUrl}>Badge SVG</a>
          </div>
        </div>
        <div className="panel" style={{ padding: 26 }}>
          <div className="metric-label">Overall score</div>
          <div className="metric-value gradient-text">{report.scores.overall}</div>
          <div className="progress"><span style={{ width: `${report.scores.overall}%` }} /></div>
          <p className="muted">Posture: <strong>{strategy?.posture || "unknown"}</strong><br />Risk: <strong>{strategy?.riskLevel || "unknown"}</strong></p>
        </div>
      </section>

      <section className="section">
        <div className="grid-3">
          {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
        </div>
      </section>

      {strategy && (
        <section className="grid-2" style={{ marginBottom: 16 }}>
          <Panel title="Strategy Brief">
            <p className="muted" style={{ marginTop: 0 }}>{strategy.summary.en}</p>
            <ul className="list">{strategy.priorityActions.map((action) => <li key={action.id}><strong>{action.impact}/{action.effort}</strong> - {action.en}</li>)}</ul>
          </Panel>
          <Panel title="Automation Boundary">
            <ul className="list">{strategy.automationBoundary.map((item) => <li key={item.level}><strong>{item.level}</strong> - {item.en}</li>)}</ul>
          </Panel>
        </section>
      )}

      <section className="grid-2">
        <Panel title="Evidence chain">
          <ul className="list">{(report.evidence || []).slice(0, 8).map((item) => <li key={item.id || item.title}>{item.title || item.en || item.zh}</li>)}</ul>
        </Panel>
        <Panel title="Create a Fix PR">
          <p className="muted">Turn the report into a reviewable pull request. If the GitHub App is not installed, RepoReady shows a patch preview instead.</p>
          <FixPrButton repo={links.githubUrl} installationId={installationId} />
        </Panel>
      </section>

      <section className="section grid-2">
        <Panel title="Top issues"><List items={report.issues.slice(0, 7).map((i) => `${i.severity.toUpperCase()} - ${i.title}`)} empty="No major issues detected." /></Panel>
        <Panel title="Fixability"><List items={[`Safe automatic fixes: ${plan.safe.length}`, `Needs review: ${plan.review.length}`, `Manual only: ${plan.manual.length}`, ...[...plan.safe, ...plan.review].slice(0, 5).map((c) => c.path)]} /></Panel>
      </section>

      {strategy && <section className="grid-2"><Panel title="Growth plan"><List items={strategy.growthPlan.map((item) => item.en)} /></Panel><Panel title="README badge"><pre className="code">{`[![RepoReady](${links.badgeUrl})](${links.publicUrl})`}</pre></Panel></section>}

      <section className="section grid-2">
        <Panel title="Social copy"><pre className="code">{copy.x}{"\n\n"}{copy.zh}</pre></Panel>
        <Panel title="Share card"><img alt="RepoReady share card" src={links.shareCardUrl} style={{ width: "100%", borderRadius: 20, border: "1px solid var(--line)" }} /></Panel>
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
