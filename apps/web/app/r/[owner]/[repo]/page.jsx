import { buildFixPlan, renderReport } from "@repoready/core";
import FixPrButton from "../../../components/FixPrButton";
import { buildReportLinks, buildSocialCopy, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} - RepoReady Report`,
    description: `AI Agent Readiness audit for ${owner}/${repo}`,
    openGraph: {
      title: `${owner}/${repo} - RepoReady`,
      description: "AI Agent Readiness audit for Codex, Claude Code, Cursor, and contributors.",
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
        <nav className="nav-links">
          <a href="/index">Index</a>
          <a href={`https://github.com/${owner}/${repo}`}>GitHub</a>
        </nav>
      </header>
      <main className="shell report-main">
        {error ? <ErrorView owner={owner} repo={repo} error={error} /> : <ReportView report={report} installationId={installationId} />}
      </main>
    </>
  );
}

function ErrorView({ owner, repo, error }) {
  return (
    <section className="panel report-panel">
      <h1>Scan failed</h1>
      <p className="error">{error}</p>
      <a className="btn btn-secondary" href={`https://github.com/${owner}/${repo}`}>Open on GitHub</a>
    </section>
  );
}

function ReportView({ report, installationId }) {
  const links = buildReportLinks(report);
  const copy = buildSocialCopy(report);
  const plan = buildFixPlan(report);
  const strategy = report.strategy;
  const risks = report.agentFailureRisk?.risks || [];
  const fullName = report.repository.fullName || report.repository.name;
  const [ownerName, repoName] = fullName.split("/");
  const topRisk = report.agentFailureRisk?.topRisks?.[0] || risks[0];
  const metrics = [
    ["Agent Ready", report.scores.agentReady, "Agent instructions and scope clarity"],
    ["Contributor", report.scores.contributorReady, "Install, usage, test, and contribution path"],
    ["Context", report.scores.contextQuality, "Clean files and low context noise"],
    ["Safety", report.scores.safety, "Dangerous scripts and manual-only boundaries"],
    ["Code Quality", report.scores.codeQuality, "Tests, checks, lockfiles, and CI signals"]
  ];

  return (
    <>
      <section className="report-hero">
        <div className="panel hero-panel report-hero-copy">
          <div className="report-cover-top">
            <div className="repo-identity">
              <div className="repo-avatar">{repoName?.slice(0, 1)?.toUpperCase() || "R"}</div>
              <div>
                <div className="repo-owner">{ownerName}</div>
                <div className="repo-name">{repoName || fullName}</div>
              </div>
            </div>
            <div className="report-kicker">{report.cached ? "Cached scan" : "Fresh scan"}</div>
          </div>
          <h1>AI agent readiness audit</h1>
          <p className="report-subtitle">
            RepoReady reviewed <strong>{fullName}</strong> for Codex, Claude Code, Cursor, and contributors.
            The report turns repository signals into evidence, failure risks, and a safe Fix PR path.
          </p>
          <div className="report-pipeline">
            <span><small>01</small> Current State</span>
            <span><small>02</small> Failure Risk</span>
            <span><small>03</small> Fix Path</span>
            <span><small>04</small> Share</span>
          </div>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#fix-pr">Create Fix PR</a>
            <div className="report-link-row">
              <a href={links.githubUrl}>Open GitHub</a>
              <a href={links.shareCardUrl}>Share Card</a>
              <a href={links.badgeUrl}>Badge SVG</a>
            </div>
          </div>
        </div>

        <aside className="panel score-panel report-score-card">
          <div className="score-card-top">
            <div>
              <div className="metric-label">Overall score</div>
              <div className="score-caption">Agent readiness posture</div>
            </div>
            <span className={`risk-pill risk-pill-${String(strategy?.riskLevel || "unknown").toLowerCase()}`}>{strategy?.riskLevel || "unknown"}</span>
          </div>
          <div className="score-orb">
            <div className="score-orb-ring" style={{ "--score": `${report.scores.overall}%` }}>
              <div className="score-number gradient-text">{report.scores.overall}</div>
              <div className="score-denominator">/100</div>
            </div>
          </div>
          <div className="score-scale"><span style={{ width: `${report.scores.overall}%` }} /></div>
          <div className="score-insight">
            <span>Top risk</span>
            <strong>{topRisk ? `${topRisk.title} (${topRisk.level})` : "No major risk"}</strong>
          </div>
          <div className="state-grid score-state-grid">
            <span><small>Posture</small><strong>{strategy?.posture || "unknown"}</strong></span>
            <span><small>Evidence</small><strong>{strategy?.evidenceConfidence ?? 0}%</strong></span>
            <span><small>Top risks</small><strong>{report.agentFailureRisk?.topRisks?.length || 0}</strong></span>
          </div>
        </aside>
      </section>

      <section className="report-section">
        <SectionHead
          label="Current State"
          title="Scorecard backed by audit evidence."
          text="The report is designed for maintainers: high-level enough to share, specific enough to act on."
        />
        <div className="metric-grid report-metric-grid">
          {metrics.map(([label, value, text]) => <Metric key={label} label={label} value={value} text={text} />)}
        </div>
      </section>

      {strategy && (
        <section className="report-section strategy-layout">
          <Panel title="Strategy Brief">
            <p className="muted strategy-summary">{strategy.summary.en}</p>
            <ul className="list premium-list">
              {strategy.priorityActions.map((action) => (
                <li key={action.id}><strong>{action.impact}/{action.effort}</strong> - {action.en}</li>
              ))}
            </ul>
          </Panel>
          <Panel title="Recommended Path">
            <PathGroup title="Now" items={strategy.recommendedPath?.now?.map((i) => i.en)} />
            <PathGroup title="Next" items={strategy.recommendedPath?.next?.map((i) => i.en)} />
            <PathGroup title="Later" items={strategy.recommendedPath?.later?.map((i) => i.en)} />
          </Panel>
        </section>
      )}

      <section className="report-section">
        <SectionHead
          label="Why Agents May Fail"
          title="Failure modes before they become bad PRs."
          text="RepoReady predicts where agents are likely to drift, get stuck, or make unsafe assumptions."
        />
        <div className="risk-grid">
          {risks.map((risk) => <RiskCard key={risk.id} risk={risk} />)}
        </div>
      </section>

      <section className="report-section" id="fix-pr">
        <SectionHead
          label="Fix Path"
          title="Safe automation, review-required work, and manual-only boundaries."
          text="RepoReady separates low-risk generated files from changes that need human review."
        />
        <div className="fix-grid">
          <FixBucket title="Safe automatic fixes" items={plan.safe} empty="No safe fixes needed." />
          <FixBucket title="Review-required fixes" items={plan.review} empty="No review fixes needed." />
          <Panel title="Manual-only boundaries">
            <List items={plan.manual.map((i) => `${i.severity.toUpperCase()} - ${i.en}`)} empty="No manual-only warnings." />
          </Panel>
        </div>
        <div className="panel cta-panel">
          <div>
            <div className="report-kicker">GitHub-native workflow</div>
            <h2>Create a Fix PR</h2>
            <p className="muted">
              Generate a professional PR body with evidence, risks, change reasons, and validation commands.
              If the GitHub App is not installed, RepoReady shows a copyable patch preview instead.
            </p>
          </div>
          <FixPrButton repo={links.githubUrl} installationId={installationId} initialPlan={plan} />
        </div>
      </section>

      <section className="report-section evidence-layout">
        <Panel title="Audit Evidence Chain">
          <ul className="list evidence-list premium-list">
            {(report.evidence || []).slice(0, 10).map((item) => (
              <li key={item.id}>
                <strong>{item.status.toUpperCase()}</strong> {item.title}<br />
                <span>{item.source}{item.detail ? ` - ${item.detail}` : ""}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Top Issues">
          <List items={report.issues.slice(0, 8).map((i) => `${i.severity.toUpperCase()} - ${i.title}`)} empty="No major issues detected." />
        </Panel>
      </section>

      <section className="report-section">
        <SectionHead
          label="Share / Growth"
          title="Make readiness visible."
          text="Turn the audit into a badge, social card, and distribution artifact."
        />
        <div className="share-layout">
          <Panel title="README badge"><pre className="code">{`[![RepoReady](${links.badgeUrl})](${links.publicUrl})`}</pre></Panel>
          <Panel title="Social copy"><pre className="code">{copy.x}{"\n\n"}{copy.reddit}{"\n\n"}{copy.zh}</pre></Panel>
        </div>
        <div className="panel share-card-frame">
          <img alt="RepoReady share card" src={links.shareCardUrl} />
        </div>
      </section>

      <section className="report-section">
        <Panel title="Markdown report">
          <pre className="code report-markdown">{renderReport(report, { format: "markdown", lang: "en" })}</pre>
        </Panel>
      </section>
    </>
  );
}

function SectionHead({ label, title, text }) {
  return (
    <div className="report-section-head">
      <p className="eyebrow">{label}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function PathGroup({ title, items = [] }) {
  return <div className="path-group"><strong>{title}</strong><List items={items} empty="No items." /></div>;
}

function RiskCard({ risk }) {
  return (
    <article className={`risk-card risk-${risk.level}`}>
      <div className="risk-top"><strong>{risk.title}</strong><span>{risk.level}</span></div>
      <div className="risk-score">{risk.score}<small>/100</small></div>
      <p>{risk.whyAgentsFail}</p>
      <ul>{(risk.evidence || []).slice(0, 3).map((e) => <li key={`${risk.id}-${e.source}-${e.detail}`}>{e.source}: {e.detail}</li>)}</ul>
      <p className="muted"><strong>Mitigation:</strong> {risk.mitigation}</p>
    </article>
  );
}

function FixBucket({ title, items, empty }) {
  return <Panel title={title}><List items={(items || []).map((item) => `${item.path} - ${item.reason || "Generated by RepoReady"}`)} empty={empty} /></Panel>;
}

function Metric({ label, value, text }) {
  return (
    <div className="card metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <p>{text}</p>
      <div className="score-scale compact"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function Panel({ title, children }) {
  return <section className="panel report-panel"><h2 className="panel-title">{title}</h2>{children}</section>;
}

function List({ items, empty }) {
  return items?.length ? <ul className="list premium-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty || "No items."}</p>;
}
