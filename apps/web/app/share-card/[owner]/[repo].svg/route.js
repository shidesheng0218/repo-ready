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
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#05060a"/><stop offset=".55" stop-color="#0b1020"/><stop offset="1" stop-color="#111827"/></linearGradient>
    <linearGradient id="accent" x1="0" x2="1"><stop stop-color="#6ee7ff"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="70"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1010" cy="80" r="210" fill="#6ee7ff" opacity=".18" filter="url(#blur)"/>
  <circle cx="130" cy="570" r="250" fill="#a78bfa" opacity=".16" filter="url(#blur)"/>
  <rect x="72" y="72" width="1056" height="486" rx="42" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.16)"/>
  <text x="118" y="136" font-family="Inter,Segoe UI,Arial" font-size="26" font-weight="850" fill="#6ee7ff" letter-spacing="3">REPOREADY</text>
  <text x="118" y="212" font-family="Inter,Segoe UI,Arial" font-size="56" font-weight="900" fill="#f8fafc">AI Agent Readiness Report</text>
  <text x="118" y="266" font-family="Inter,Segoe UI,Arial" font-size="30" fill="#cbd5e1">${escapeXml(fullName)}</text>
  <text x="118" y="410" font-family="Inter,Segoe UI,Arial" font-size="116" font-weight="950" fill="#f8fafc">${score}</text>
  <text x="318" y="392" font-family="Inter,Segoe UI,Arial" font-size="28" font-weight="800" fill="#94a3b8">Overall</text>
  <text x="318" y="430" font-family="Inter,Segoe UI,Arial" font-size="22" fill="#94a3b8">Ready for Codex, Claude Code, Cursor, and contributors.</text>
  ${metric(760, 330, "Agent", agent)}${metric(760, 390, "Contributor", contributor)}${metric(760, 450, "Safety", safety)}
  <text x="118" y="516" font-family="Inter,Segoe UI,Arial" font-size="22" fill="#94a3b8">${issues} issues · ${fixes} PR-ready fixes · repoready.dev</text>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=600" } });
}

function metric(x, y, label, value) {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial" font-size="24" font-weight="800" fill="#6ee7ff">${label}</text><text x="1000" y="${y}" text-anchor="end" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="900" fill="#f8fafc">${value}</text>`;
}
function escapeXml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
