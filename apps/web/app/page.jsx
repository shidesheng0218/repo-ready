export default function Home() {
  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", position: "relative" }}>
      {/* Hero */}
      <header style={{ textAlign: "center", marginBottom: 80 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 18px", borderRadius: 999, background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.15)", marginBottom: 32 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: "#38bdf8", boxShadow: "0 0 8px rgba(56,189,248,0.6)" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#38bdf8", letterSpacing: 1 }}>REPOREADY</span>
        </div>
        <h1 style={{ fontSize: 72, lineHeight: 1.04, margin: "0 auto 24px", maxWidth: 900, fontWeight: 900, background: "linear-gradient(135deg, #f8fafc 0%, #94a3b8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Make your repository ready for AI coding agents.
        </h1>
        <p style={{ fontSize: 22, color: "#94a3b8", maxWidth: 680, margin: "0 auto 48px", lineHeight: 1.6 }}>
          让你的仓库更适合 Codex、Claude Code、Cursor 等 AI 编程代理协作，也更容易被贡献者理解。
        </p>
        <form action="/report" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <input
            name="repo"
            placeholder="https://github.com/user/repo"
            style={{
              flex: "1 1 520px",
              maxWidth: 560,
              padding: "18px 24px",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.15)",
              background: "rgba(15,23,42,0.9)",
              backdropFilter: "blur(12px)",
              color: "#e2e8f0",
              fontSize: 16,
              outline: "none"
            }}
          />
          <button
            style={{
              padding: "18px 28px",
              borderRadius: 16,
              border: 0,
              background: "linear-gradient(135deg, #38bdf8, #2563eb)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
              transition: "transform 0.15s",
              boxShadow: "0 4px 24px rgba(56,189,248,0.25)"
            }}
          >
            Scan repo
          </button>
        </form>
        <div style={{ marginTop: 24, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            ["npm", "npx repoready"],
            ["CLI", "repoready fix"],
            ["Action", "GitHub Actions"]
          ].map(([label, cmd]) => (
            <code key={label} style={{ padding: "8px 16px", borderRadius: 999, background: "rgba(15,23,42,0.8)", border: "1px solid rgba(148,163,184,0.10)", fontSize: 13, color: "#94a3b8" }}>
              {label} · {cmd}
            </code>
          ))}
        </div>
      </header>

      {/* Stats */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 80 }}>
        {[
          ["4", "Scores"],
          ["10+", "Languages"],
          ["6", "Templates"],
          ["0", "API keys needed"]
        ].map(([value, label]) => (
          <div key={label} style={{ padding: 32, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 20, background: "linear-gradient(180deg, rgba(15,23,42,0.8), rgba(2,6,23,0.8))", backdropFilter: "blur(8px)", textAlign: "center" }}>
            <div style={{ fontSize: 42, fontWeight: 900, background: "linear-gradient(135deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{value}</div>
            <div style={{ color: "#94a3b8", marginTop: 8, fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </section>

      {/* Score grid */}
      <section style={{ marginBottom: 80 }}>
        <h2 style={{ textAlign: "center", fontSize: 32, fontWeight: 800, marginBottom: 48 }}>What RepoReady checks</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {[
            ["Agent Ready", "AGENTS.md, commands, structure, safety notes for AI agents.", "🤖"],
            ["Contributor Ready", "README, install, usage, testing, contributing guidance.", "👥"],
            ["Context Quality", "Noise, generated files, large files, ignore rules.", "📦"],
            ["Safety", "Dangerous scripts, env files, destructive workflows.", "🛡️"]
          ].map(([title, desc, icon]) => (
            <div key={title} style={{ padding: 28, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 20, background: "linear-gradient(180deg, rgba(15,23,42,0.8), rgba(2,6,23,0.8))", backdropFilter: "blur(8px)", transition: "border-color 0.2s" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</div>
              <div style={{ color: "#94a3b8", lineHeight: 1.6, fontSize: 14 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Demo */}
      <section style={{ marginBottom: 80, padding: 48, border: "1px solid rgba(148,163,184,0.08)", borderRadius: 24, background: "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(2,6,23,0.9))", backdropFilter: "blur(12px)", overflow: "hidden" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 800, marginBottom: 32 }}>See it in action</h2>
        <pre style={{ margin: 0, padding: "32px 36px", borderRadius: 16, background: "#020617", border: "1px solid rgba(148,163,184,0.08)", fontSize: 14, lineHeight: 1.8, overflow: "auto", color: "#cbd5e1" }}>
{`RepoReady Report · my-repo
================================
Overall Score: 82/100 ████████░░

AI Agent Ready      ███████░░░ 70/100
Contributor Ready   ████████░░ 80/100
Context Quality     █████████░ 90/100
Safety              ████████░░ 85/100

Top Issues
  ! [high] Missing AGENTS.md
  › [medium] No CI workflow

PR-ready Fixes
  + AGENTS.md
  + README.md
  + .github/workflows/repoready.yml`}
        </pre>
      </section>

      {/* CTA */}
      <section style={{ textAlign: "center", padding: "64px 48px", border: "1px solid rgba(56,189,248,0.12)", borderRadius: 24, background: "linear-gradient(180deg, rgba(56,189,248,0.06), transparent)" }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Ready to make your repo AI-agent ready?</h2>
        <p style={{ color: "#94a3b8", fontSize: 18, marginBottom: 32 }}>Free, open source, no API keys required.</p>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="https://github.com" style={{ padding: "14px 28px", borderRadius: 14, background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#fff", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 24px rgba(56,189,248,0.25)" }}>
            Star on GitHub
          </a>
          <code style={{ padding: "14px 28px", borderRadius: 14, background: "rgba(15,23,42,0.9)", border: "1px solid rgba(148,163,184,0.10)", color: "#94a3b8", fontSize: 15 }}>
            npx repoready
          </code>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 80, textAlign: "center", color: "#475569", fontSize: 14 }}>
        RepoReady · MIT License · Open source
      </footer>
    </main>
  );
}
