import { renderReport, scanGitHubRepository } from "@repoready/core";
import LeaderboardTeaser from "./leaderboard-teaser";

export default async function ReportPage({ searchParams }) {
  const repo = searchParams?.repo;
  let report = null;
  let error = null;

  if (repo) {
    try {
      report = await scanGitHubRepository(repo);
      submitToLeaderboard(report);
    } catch (e) {
      error = e.message;
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
      <nav style={{ marginBottom: 32, display: "flex", gap: 20, alignItems: "center" }}>
        <a href="/" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600, fontSize: 15 }}>← RepoReady</a>
        <span style={{ color: "#475569" }}>|</span>
        <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.15)", fontSize: 12, fontWeight: 700, color: "#38bdf8", letterSpacing: 1 }}>
          PUBLIC REPORT
        </span>
      </nav>
      {!repo ? <EmptyState /> : error ? <ErrorState message={error} /> : <ReportView report={report} />}
    </main>
  );
}

async function submitToLeaderboard(report) {
  try {
    await fetch(new URL("/leaderboard", `http://localhost:${process.env.PORT || 3000}`).href, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        repo: report.repository.name,
        overall: report.scores.overall,
        agentReady: report.scores.agentReady,
        contributorReady: report.scores.contributorReady,
        contextQuality: report.scores.contextQuality,
        safety: report.scores.safety
      })
    });
  } catch {
    // best-effort only
  }
}

function EmptyState() {
  return (
    <section style={heroPanelStyle}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔎</div>
      <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>Enter a GitHub repository URL</h2>
      <p style={{ color: "#94a3b8", fontSize: 16, margin: 0 }}>Paste a public GitHub repo URL to generate a RepoReady report.</p>
    </section>
  );
}

function ErrorState({ message }) {
  return (
    <section style={{ padding: 32, border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, background: "rgba(127,29,29,0.18)", color: "#fca5a5" }}>
      <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Scan failed</div>
      <div>{message}</div>
    </section>
  );
}

function ReportView({ report }) {
  const metrics = [
    ["Overall", report.scores.overall, "#38bdf8", null],
    ["Agent Ready", report.scores.agentReady, "#818cf8", report.scores.confidence?.agentReady],
    ["Contributor Ready", report.scores.contributorReady, "#34d399", report.scores.confidence?.contributorReady],
    ["Context Quality", report.scores.contextQuality, "#fbbf24", report.scores.confidence?.contextQuality],
    ["Safety", report.scores.safety, "#f472b6", report.scores.confidence?.safety]
  ];

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 44, fontWeight: 950, margin: "0 0 8px", background: "linear-gradient(135deg, #f8fafc, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {report.repository.name}
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 16, margin: 0 }}>
            Bilingual report and fix suggestions for AI coding agents and contributors.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ActionLink href={`/badge?score=${report.scores.overall}`} color="#38bdf8">Badge</ActionLink>
          <ActionLink href={`/share-card?repo=${encodeURIComponent(report.repository.name)}&score=${report.scores.overall}&agent=${report.scores.agentReady}&contributor=${report.scores.contributorReady}&safety=${report.scores.safety}`} color="#818cf8">Share Card</ActionLink>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 24 }}>
        {metrics.map(([label, value, color, confidence]) => (
          <MetricCard key={label} label={label} value={value} color={color} confidence={confidence} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <BaselinePanel comparison={report.scoreComparison} />
        <Panel title="Confidence Model" icon="🎯">
          <List
            items={[
              `Agent Ready: ${toPercent(report.scores.confidence?.agentReady)} signal confidence`,
              `Contributor Ready: ${toPercent(report.scores.confidence?.contributorReady)} signal confidence`,
              `Context Quality: ${toPercent(report.scores.confidence?.contextQuality)} scan confidence`,
              `Safety: ${toPercent(report.scores.confidence?.safety)} static-analysis confidence`
            ]}
          />
        </Panel>
      </div>

      <section style={{ marginBottom: 32, padding: 24, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 20, background: panelBackground }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Share Card</h2>
          <span style={{ color: "#64748b", fontSize: 13 }}>Use this image in social posts or README</span>
        </div>
        <img
          alt="RepoReady share card"
          src={`/share-card?repo=${encodeURIComponent(report.repository.name)}&score=${report.scores.overall}&agent=${report.scores.agentReady}&contributor=${report.scores.contributorReady}&safety=${report.scores.safety}`}
          style={{ width: "100%", borderRadius: 16, border: "1px solid rgba(148,163,184,0.08)" }}
        />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <Panel title="Top Issues" icon="⚠️">
          <List items={report.issues.slice(0, 6).map((issue) => `${issue.title} / ${issue.titleZh}`)} empty="No issues detected." />
        </Panel>
        <Panel title="Quick Wins" icon="✅">
          <List items={report.recommendations.filter((item) => item.fixable).slice(0, 6).map((item) => `${item.en} / ${item.zh}`)} empty="No quick wins needed." />
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <Panel title="Task Suggestions" icon="💡">
          <List items={report.taskSuggestions.slice(0, 6).map((item) => `${item.en} / ${item.zh}`)} empty="No suggestions." />
        </Panel>
        <Panel title="Fix-ready Files" icon="📄">
          <List items={report.fixes.changes.map((change) => change.path)} empty="No fixes needed." />
        </Panel>
      </div>

      <Panel title="README Badge" icon="🏷️" style={{ marginBottom: 20 }}>
        <pre style={preStyle}>{`![RepoReady](/badge?score=${report.scores.overall})`}</pre>
      </Panel>

      <Panel title="Markdown Preview" icon="📝" style={{ marginBottom: 20 }}>
        <pre style={{ ...preStyle, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {renderReport(report, { format: "markdown", lang: "en" })}
        </pre>
      </Panel>

      <LeaderboardTeaser />

      {report.deepAnalysis && <DeepAnalysisView analysis={report.deepAnalysis} />}
    </>
  );
}

function BaselinePanel({ comparison }) {
  if (!comparison?.hasBaseline) {
    return (
      <Panel title="Before / After Baseline" icon="📈">
        <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.7 }}>
          No baseline yet. Run <code>repoready --save-baseline</code> on a known-good version, then scan again to show deltas.
        </p>
      </Panel>
    );
  }

  const rows = [
    ["Overall", comparison.deltas.overall],
    ["Agent Ready", comparison.deltas.agentReady],
    ["Contributor Ready", comparison.deltas.contributorReady],
    ["Context Quality", comparison.deltas.contextQuality],
    ["Safety", comparison.deltas.safety]
  ];

  return (
    <Panel title="Before / After Baseline" icon="📈">
      <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>{comparison.summary.en}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(([label, delta]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: 14 }}>
            <span>{label}</span>
            <span style={{ color: delta >= 0 ? "#34d399" : "#ef4444", fontWeight: 800 }}>{formatDelta(delta)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DeepAnalysisView({ analysis }) {
  return (
    <section style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 24, background: "linear-gradient(135deg, #f8fafc, #94a3b8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
        Deep Analysis
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {analysis.readmeQuality && (
          <Panel title="README Quality" icon="📚">
            <BigNumber value={analysis.readmeQuality.grade} color="#38bdf8" suffix={`${analysis.readmeQuality.score}/100`} />
            <div style={bodyTextStyle}>{analysis.readmeQuality.summary.en}</div>
            {analysis.readmeQuality.missingSections.length > 0 && (
              <div style={{ marginTop: 12, color: "#fbbf24", fontSize: 13 }}>Missing: {analysis.readmeQuality.missingSections.join(", ")}</div>
            )}
          </Panel>
        )}
        {analysis.dependencyHealth && (
          <Panel title="Dependencies" icon="📦">
            <BigNumber value={`${analysis.dependencyHealth.score}/100`} color={analysis.dependencyHealth.score >= 80 ? "#34d399" : "#fbbf24"} />
            <div style={bodyTextStyle}>{analysis.dependencyHealth.summary.en}</div>
            <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 13, color: "#94a3b8" }}>
              <span>{analysis.dependencyHealth.totalDeps} total</span>
              <span>{analysis.dependencyHealth.prodDeps} prod</span>
              <span>{analysis.dependencyHealth.devDeps} dev</span>
            </div>
          </Panel>
        )}
        {analysis.safetyBoundaries && (
          <Panel title="Safety Boundaries" icon="🛡️">
            <BigNumber value={`${analysis.safetyBoundaries.score}/100`} color={analysis.safetyBoundaries.score >= 80 ? "#34d399" : "#ef4444"} />
            <div style={bodyTextStyle}>{analysis.safetyBoundaries.summary.en}</div>
            <List items={analysis.safetyBoundaries.boundaries.slice(0, 3).map((b) => b.en)} empty="No critical safety boundaries detected." />
          </Panel>
        )}
        {analysis.taskGraph && (
          <Panel title="Task Graph" icon="📋">
            <BigNumber value={analysis.taskGraph.totalTasks} color="#818cf8" suffix={`tasks · ~${analysis.taskGraph.totalEstimatedMinutes} min`} />
            <List items={analysis.taskGraph.tasks.slice(0, 5).map((task) => `[${task.priority}] ${task.en}`)} />
          </Panel>
        )}
      </div>
    </section>
  );
}

function ActionLink({ href, color, children }) {
  return (
    <a href={href} style={{ padding: "10px 20px", borderRadius: 12, background: `${color}1A`, border: `1px solid ${color}33`, color, textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
      {children}
    </a>
  );
}

function MetricCard({ label, value, color, confidence }) {
  return (
    <div style={{ padding: 24, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 20, background: panelBackground, textAlign: "center" }}>
      <div style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 48, fontWeight: 950, color }}>{value}</div>
      <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>/100</div>
      {confidence != null && <div style={{ marginTop: 10, color: "#94a3b8", fontSize: 12 }}>confidence {toPercent(confidence)}</div>}
    </div>
  );
}

function BigNumber({ value, color, suffix }) {
  return (
    <>
      <div style={{ fontSize: 36, fontWeight: 950, color, marginBottom: 8 }}>{value}</div>
      {suffix && <div style={{ color: "#94a3b8", marginBottom: 12 }}>{suffix}</div>}
    </>
  );
}

function Panel({ title, icon, children, style = {} }) {
  return (
    <section style={{ padding: 24, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 20, background: panelBackground, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {icon && <span style={{ fontSize: 20 }}>{icon}</span>}
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function List({ items, empty }) {
  if (!items || !items.length) {
    return <div style={{ color: "#64748b", fontStyle: "italic" }}>{empty || "No items."}</div>;
  }
  return (
    <ul style={{ margin: 0, paddingLeft: 20, color: "#cbd5e1", lineHeight: 1.8, fontSize: 14 }}>
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function toPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatDelta(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

const panelBackground = "linear-gradient(180deg, rgba(15,23,42,0.86), rgba(2,6,23,0.88))";
const heroPanelStyle = { textAlign: "center", padding: "80px 24px", border: "1px solid rgba(148,163,184,0.08)", borderRadius: 24, background: panelBackground };
const bodyTextStyle = { color: "#cbd5e1", lineHeight: 1.6, fontSize: 14 };
const preStyle = { margin: 0, padding: 16, borderRadius: 12, background: "#020617", border: "1px solid rgba(148,163,184,0.08)", color: "#cbd5e1", fontSize: 14, overflow: "auto" };
