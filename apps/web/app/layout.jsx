import "./globals.css";

export const metadata = {
  title: "RepoReady — AI Agent Readiness for GitHub Repositories",
  description: "Scan your repository for Codex, Claude Code, Cursor, and contributor readiness. Generate reports, badges, fix plans, and Fix PRs.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    title: "RepoReady — AI Agent Readiness",
    description: "Make your repo ready for humans, AI agents, and growth.",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
