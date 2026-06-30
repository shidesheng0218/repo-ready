import { readReport, scanRepoCached, siteUrl } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { owner, repo } = await params;
  let report = await readReport(owner, repo);
  if (!report) {
    try {
      report = await scanRepoCached({ owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` });
    } catch {}
  }

  const fullName = `${owner}/${repo}`;
  const scores = report?.scores || {};
  const overall = scores.overall ?? "scan";
  const agent = scores.agentReady ?? "scan";
  const safety = scores.safety ?? "scan";
  const risks = (report?.agentFailureRisk?.topRisks || report?.agentFailureRisk?.risks || [])
    .slice(0, 2)
    .map((risk) => `${risk.title}: ${risk.level}`)
    .join(" · ") || "Ready for AI coding agents";
  const publicUrl = `${siteUrl()}/r/${owner}/${repo}`;
  const displayUrl = publicUrl.replace("https://", "").replace("http://", "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="RepoReady report for ${escapeXml(fullName)}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fbfdff"/><stop offset="1" stop-color="#eef4ff"/></linearGradient>
    <linearGradient id="accent" x1="0" x2="1"><stop stop-color="#0f172a"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="28" stdDeviation="34" flood-color="#0f172a" flood-opacity=".14"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1030" cy="68" r="250" fill="#2563eb" opacity=".11"/>
  <circle cx="82" cy="590" r="260" fill="#0ea5e9" opacity=".10"/>
  <rect x="72" y="68" width="1056" height="494" rx="44" fill="#ffffff" stroke="#dbe5f3" filter="url(#shadow)"/>
  <rect x="112" y="110" width="36" height="36" rx="11" fill="url(#accent)"/>
  <text x="162" y="137" font-family="Segoe UI,Arial,sans-serif" font-size="24" font-weight="850" fill="#0f172a">RepoReady</text>
  <text x="112" y="218" font-family="Segoe UI,Arial,sans-serif" font-size="56" font-weight="900" fill="#0f172a" letter-spacing="-2.4">AI Agent Readiness Audit</text>
  <text x="112" y="270" font-family="Segoe UI,Arial,sans-serif" font-size="30" fill="#64748b">${escapeXml(fullName)}</text>
  <rect x="112" y="324" width="254" height="138" rx="28" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="140" y="372" font-family="Segoe UI,Arial,sans-serif" font-size="20" font-weight="800" fill="#64748b">Overall</text>
  <text x="140" y="432" font-family="Segoe UI,Arial,sans-serif" font-size="64" font-weight="950" fill="#0f172a" letter-spacing="-3">${escapeXml(overall)}</text>
  ${metric(402, 324, "Agent Ready", agent)}
  ${metric(692, 324, "Safety", safety)}
  <rect x="402" y="414" width="544" height="48" rx="18" fill="#eff6ff" stroke="#bfdbfe"/>
  <text x="430" y="445" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="750" fill="#1d4ed8">${escapeXml(risks)}</text>
  <text x="112" y="520" font-family="Segoe UI,Arial,sans-serif" font-size="22" fill="#64748b">Make your repo ready for Codex, Claude Code, Cursor</text>
  <text x="1088" y="520" text-anchor="end" font-family="Segoe UI,Arial,sans-serif" font-size="20" font-weight="800" fill="#2563eb">${escapeXml(displayUrl)}</text>
</svg>`;

  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}

function metric(x, y, label, value) {
  return `<rect x="${x}" y="${y}" width="254" height="78" rx="22" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="${x + 24}" y="${y + 32}" font-family="Segoe UI,Arial,sans-serif" font-size="18" font-weight="800" fill="#64748b">${label}</text>
  <text x="${x + 222}" y="${y + 52}" text-anchor="end" font-family="Segoe UI,Arial,sans-serif" font-size="36" font-weight="950" fill="#0f172a">${escapeXml(value)}</text>`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
