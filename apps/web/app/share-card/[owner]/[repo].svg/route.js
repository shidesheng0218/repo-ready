import { readReport, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { owner, repo } = params;
  let report = await readReport(owner, repo);
  if (!report) {
    try { report = await scanRepoCached({ owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` }); } catch {}
  }
  const fullName = `${owner}/${repo}`;
  const scores = report?.scores || {};
  const score = scores.overall ?? "—";
  const agent = scores.agentReady ?? "—";
  const contributor = scores.contributorReady ?? "—";
  const safety = scores.safety ?? "—";
  const issues = report?.issues?.length ?? "—";
  const fixes = report?.fixes?.changes?.length ?? "—";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#f6f3ee"/><stop offset="1" stop-color="#ebe7df"/></linearGradient>
    <linearGradient id="accent" x1="0" x2="1"><stop stop-color="#2563eb"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#29241d" flood-opacity=".16"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="980" cy="80" r="230" fill="#2563eb" opacity=".10"/>
  <circle cx="120" cy="590" r="260" fill="#7c3aed" opacity=".09"/>
  <rect x="72" y="72" width="1056" height="486" rx="42" fill="#fffdf8" stroke="rgba(23,23,23,.10)" filter="url(#shadow)"/>
  <rect x="112" y="110" width="34" height="34" rx="11" fill="url(#accent)"/>
  <text x="160" y="136" font-family="Inter,Segoe UI,Arial" font-size="24" font-weight="850" fill="#171717" letter-spacing="-1">RepoReady</text>
  <text x="112" y="218" font-family="Inter,Segoe UI,Arial" font-size="58" font-weight="900" fill="#171717" letter-spacing="-3">AI Agent Readiness</text>
  <text x="112" y="268" font-family="Inter,Segoe UI,Arial" font-size="30" fill="#64615c">${escapeXml(fullName)}</text>
  <text x="112" y="420" font-family="Inter,Segoe UI,Arial" font-size="118" font-weight="950" fill="#171717" letter-spacing="-7">${score}</text>
  <text x="306" y="398" font-family="Inter,Segoe UI,Arial" font-size="27" font-weight="800" fill="#64615c">Overall Score</text>
  <text x="306" y="436" font-family="Inter,Segoe UI,Arial" font-size="22" fill="#64615c">Ready for agents, contributors, and safe Fix PRs.</text>
  ${metric(760, 334, "Agent", agent)}${metric(760, 394, "Contributor", contributor)}${metric(760, 454, "Safety", safety)}
  <text x="112" y="516" font-family="Inter,Segoe UI,Arial" font-size="22" fill="#64615c">${issues} issues ? ${fixes} PR-ready fixes ? repoready.dev</text>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=600" } });
}

function metric(x, y, label, value) {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial" font-size="24" font-weight="800" fill="#2563eb">${label}</text><text x="1000" y="${y}" text-anchor="end" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="900" fill="#171717">${value}</text>`;
}
function escapeXml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
