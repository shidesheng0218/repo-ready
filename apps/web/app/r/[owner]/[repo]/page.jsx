
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
  const risks = report.agentFailureRisk?.risks || [];
  const metrics = [
    ["Agent Ready", report.scores.agentReady],
    ["Contributor", report.scores.contributorReady],
    ["Context", report.scores.contextQuality],
    ["Safety", report.scores.safety],
    ["Code Quality", report.scores.codeQuality]
  ];

  return (
    <>
      <section className="report-hero">
        <div className="panel hero-panel">
          <div className="badge">AUDIT REPORT ? {report.cached ? "CACHED" : "FRESH SCAN"}</div>
          <h1>{report.repository.fullName || report.repository.name}</h1>
          <p className="section-lead">Current State ? Why Agents May Fail ? Fix Path. A reviewable readiness audit for Codex, Claude Code, Cursor, and contributors.</p>
          <div className="hero-actions">
            <a className="btn btn-secondary" href={links.githubUrl}>Open GitHub</a>
            <a className="btn btn-secondary" href={links.shareCardUrl}>Share Card</a>
            <a className="btn btn-secondary" href="/index">Agent Ready Index</a>
          </div>
        </div>
        <div className="panel score-panel">
          <div className="metric-label">Overall score</div>
          <div className="metric-value gradient-text">{report.scores.overall}</div>
          <div className="progress"><span style={{ width: `${report.scores.overall}%` }} /></div>
          <div className="state-grid">
            <span>Posture <strong>{strategy?.posture || "unknown"}</strong></span>
            <span>Risk <strong>{strategy?.riskLevel || "unknown"}</strong></span>
            <span>Evidence <strong>{strategy?.evidenceConfidence ?? 0}%</strong></span>
          </div>
        </div>
      </section>

      <section className="section narrative-block">
        <div className="eyebrow">01 ? Current State</div>
        <h2>Repository readiness, with evidence</h2>
        <p className="narrow muted">RepoReady does not only show a score. It shows the signals behind the score, where they came from, why they matter, and whether the fix is safe, review-required, or manual-only.</p>
        <div className="grid-3 metric-grid">
          {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
        </div>
      </section>

      {strategy && (
        <section className="grid-2 section">
          <Panel title="Strategy Brief">
            <p className="muted" style={{ marginTop: 0 }}>{strategy.summary.en}</p>
            <ul className="list">{strategy.priorityActions.map((action) => <li key={action.id}><strong>{action.impact}/{action.effort}</strong> ? {action.en}</li>)}</ul>
          </Panel>
          <Panel title="Recommended Path">
            <PathGroup title="Now" items={strategy.recommendedPath?.now?.map((i) => i.en)} />
            <PathGroup title="Next" items={strategy.recommendedPath?.next?.map((i) => i.en)} />
            <PathGroup title="Later" items={strategy.recommendedPath?.later?.map((i) => i.en)} />
          </Panel>
        </section>
      )}

      <section className="section narrative-block">
        <div className="eyebrow">02 ? Why Agents May Fail</div>
        <h2>Agent Failure Risk</h2>
        <p className="narrow muted">These cards predict the most likely failure modes for AI coding agents in this repository: scope drift, validation gaps, unsafe boundaries, onboarding gaps, and context confusion.</p>
        <div className="risk-grid">
          {risks.map((risk) => <RiskCard key={risk.id} risk={risk} />)}
        </div>
      </section>

      <section className="section narrative-block">
        <div className="eyebrow">03 ? Fix Path</div>
        <h2>Explainable, reviewable fixes</h2>
        <div className="grid-3">
          <FixBucket title="Safe automatic fixes" items={plan.safe} empty="No safe fixes needed." />
          <FixBucket title="Review-required fixes" items={plan.review} empty="No review fixes needed." />
          <Panel title="Manual-only boundaries"><List items={plan.manual.map((i) => `${i.severity.toUpperCase()} ? ${i.en}`)} empty="No manual-only warnings." /></Panel>
        </div>
        <div className="panel cta-panel">
          <div><h2>Create a Fix PR</h2><p className="muted">Generate a professional PR body with evidence, risks, change reasons, and validation commands. If the GitHub App is not installed, RepoReady shows a patch preview.</p></div>
          <FixPrButton repo={links.githubUrl} installationId={installationId} />
        </div>
      </section>

      <section className="section grid-2">
        <Panel title="Audit Evidence Chain">
          <ul className="list evidence-list">{(report.evidence || []).slice(0, 10).map((item) => <li key={item.id}><strong>{item.status.toUpperCase()}</strong> {item.title}<br /><span>{item.source}{item.detail ? ` ? ${item.detail}` : ""}</span></li>)}</ul>
        </Panel>
        <Panel title="Top Issues"><List items={report.issues.slice(0, 8).map((i) => `${i.severity.toUpperCase()} ? ${i.title}`)} empty="No major issues detected." /></Panel>
      </section>

      <section className="section narrative-block">
        <div className="eyebrow">04 ? Share / Growth</div>
        <h2>Make readiness visible</h2>
        <div className="grid-2">
          <Panel title="README badge"><pre className="code">{`[![RepoReady](${links.badgeUrl})](${links.publicUrl})`}</pre></Panel>
          <Panel title="Social copy"><pre className="code">{copy.x}{"\n\n"}{copy.zh}</pre></Panel>
        </div>
        <div className="panel" style={{ padding: 18, marginTop: 16 }}><img alt="RepoReady share card" src={links.shareCardUrl} style={{ width: "100%", borderRadius: 18, border: "1px solid var(--line)" }} /></div>
      </section>

      <section className="section">
        <Panel title="Markdown report">
          <pre className="code" style={{ maxHeight: 520 }}>{renderReport(report, { format: "markdown", lang: "en" })}</pre>
        </Panel>
      </section>
    </>
  );
}

function PathGroup({ title, items = [] }) { return <div style={{ marginBottom: 14 }}><strong>{title}</strong><List items={items} empty="No items." /></div>; }
function RiskCard({ risk }) { return <article className={`risk-card risk-${risk.level}`}><div className="risk-top"><strong>{risk.title}</strong><span>{risk.level}</span></div><div className="risk-score">{risk.score}/100</div><p>{risk.whyAgentsFail}</p><ul>{(risk.evidence || []).slice(0, 3).map((e) => <li key={`${risk.id}-${e.source}-${e.detail}`}>{e.source}: {e.detail}</li>)}</ul><p className="muted"><strong>Mitigation:</strong> {risk.mitigation}</p></article>; }
function FixBucket({ title, items, empty }) { return <Panel title={title}><List items={(items || []).map((item) => `${item.path} ? ${item.reason || "Generated by RepoReady"}`)} empty={empty} /></Panel>; }

function Metric({ label, value }) {
  return <div className="card metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="progress"><span style={{ width: `${value}%` }} /></div></div>;
}
function Panel({ title, children }) { return <section className="panel" style={{ padding: 24 }}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>; }
function List({ items, empty }) { return items?.length ? <ul className="list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty || "No items."}</p>; }
