export const metadata = {
  title: "RepoReady – AI Agent Readiness for GitHub Repositories",
  description: "Scan your repository for AI coding agent readiness. Get scores, fix suggestions, and shareable reports for Codex, Claude Code, and Cursor."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif", margin: 0, background: "#020617", color: "#e2e8f0", WebkitFontSmoothing: "antialiased" }}>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,189,248,0.12), transparent 50%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(37,99,235,0.10), transparent 50%)",
            pointerEvents: "none"
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
