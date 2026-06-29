import { readIndex } from "../lib/repoready-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Agent Ready Index · RepoReady",
  description: "A public index of GitHub repositories ranked by AI agent readiness."
};

export default async function AgentReadyIndexPage() {
  const index = await readIndex();
  const entries = index.entries || [];
  return (
    <>
      <header className="shell nav">
        <a className="brand" href="/"><span className="brand-mark" />RepoReady</a>
        <nav className="nav-links"><a href="/">Scan</a><a href="https://github.com/shidesheng0218/repo-ready">GitHub</a></nav>
      </header>
      <main className="shell section">
        <section className="panel" style={{ padding: 32, marginBottom: 22 }}>
          <div className="badge">PUBLIC DATASET · AGENT READY INDEX</div>
          <h1 style={{ fontSize: "clamp(44px, 7vw, 78px)", letterSpacing: "-.075em", lineHeight: .95, margin: "18px 0" }}>Which repos are ready for AI agents?</h1>
          <p className="section-lead">RepoReady tracks public repositories by AI-agent readiness: instructions, validation commands, safety boundaries, clean context, and contributor onboarding.</p>
          <p className="muted">Updated: {index.updatedAt ? new Date(index.updatedAt).toLocaleString() : "No scans yet"}</p>
        </section>

        {!entries.length ? <EmptyIndex /> : <IndexTable entries={entries} />}
      </main>
    </>
  );
}

function EmptyIndex() {
  return (
    <div className="grid-2">
      <div className="card">
        <h3>No index data yet</h3>
        <p>Scan a few public repositories from the homepage, or run the index scan script after adding seed repositories.</p>
      </div>
      <div className="card">
        <h3>Launch article angle</h3>
        <p>“We scanned popular GitHub repositories for AI coding agent readiness.” This turns RepoReady into a data story, not just a tool.</p>
      </div>
    </div>
  );
}

function IndexTable({ entries }) {
  return (
    <section className="panel" style={{ padding: 18, overflow: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
        <thead>
          <tr style={{ color: "var(--muted)", textAlign: "left", fontSize: 13 }}>
            <th style={th}>Rank</th><th style={th}>Repository</th><th style={th}>Overall</th><th style={th}>Agent</th><th style={th}>Safety</th><th style={th}>AGENTS</th><th style={th}>Tests</th><th style={th}>Risks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr key={entry.repo} style={{ borderTop: "1px solid var(--line)" }}>
              <td style={td}>#{index + 1}</td>
              <td style={td}><a href={`/r/${entry.repo}`} style={{ fontWeight: 850, textDecoration: "none" }}>{entry.repo}</a><div className="muted" style={{ fontSize: 12 }}>{new Date(entry.scannedAt).toLocaleDateString()}</div></td>
              <td style={td}><Score value={entry.overall} /></td>
              <td style={td}>{entry.agentReady}</td>
              <td style={td}>{entry.safety}</td>
              <td style={td}>{entry.hasAgentInstructions ? "Yes" : "No"}</td>
              <td style={td}>{entry.hasTestCommand ? "Yes" : "No"}</td>
              <td style={td}>{entry.dangerousScripts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Score({ value }) {
  return <span style={{ color: value >= 90 ? "var(--green)" : value >= 70 ? "var(--blue)" : "var(--amber)", fontWeight: 900 }}>{value}</span>;
}
const th = { padding: "12px 14px", fontWeight: 850 };
const td = { padding: "14px", verticalAlign: "middle" };
