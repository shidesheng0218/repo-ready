export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const repo = escapeXml(searchParams.get("repo") || "your/repo");
  const score = escapeXml(searchParams.get("score") || "ready");
  const agent = escapeXml(searchParams.get("agent") || "-");
  const contributor = escapeXml(searchParams.get("contributor") || "-");
  const safety = escapeXml(searchParams.get("safety") || "-");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#020617"/>
      <stop offset="0.55" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#082f49"/>
    </linearGradient>
    <linearGradient id="card" x1="0" x2="1">
      <stop offset="0" stop-color="#111827"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="120" r="180" fill="#38bdf8" opacity="0.12"/>
  <circle cx="140" cy="560" r="220" fill="#2563eb" opacity="0.14"/>
  <text x="80" y="95" font-family="Inter,Segoe UI,Arial" font-size="28" font-weight="800" fill="#38bdf8" letter-spacing="3">REPOREADY</text>
  <text x="80" y="170" font-family="Inter,Segoe UI,Arial" font-size="58" font-weight="900" fill="#f8fafc">AI Agent Readiness Report</text>
  <text x="80" y="225" font-family="Inter,Segoe UI,Arial" font-size="30" fill="#cbd5e1">${repo}</text>
  <rect x="80" y="285" width="1040" height="230" rx="30" fill="url(#card)" stroke="#334155"/>
  <text x="130" y="385" font-family="Inter,Segoe UI,Arial" font-size="92" font-weight="900" fill="#f8fafc">${score}</text>
  <text x="330" y="382" font-family="Inter,Segoe UI,Arial" font-size="34" font-weight="800" fill="#94a3b8">Overall Score</text>
  <text x="130" y="450" font-family="Inter,Segoe UI,Arial" font-size="26" fill="#cbd5e1">Ready for Codex, Claude Code, Cursor, and contributors.</text>
  <text x="760" y="345" font-family="Inter,Segoe UI,Arial" font-size="26" font-weight="800" fill="#38bdf8">Agent</text>
  <text x="960" y="345" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="900" fill="#f8fafc">${agent}</text>
  <text x="760" y="405" font-family="Inter,Segoe UI,Arial" font-size="26" font-weight="800" fill="#38bdf8">Contributor</text>
  <text x="960" y="405" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="900" fill="#f8fafc">${contributor}</text>
  <text x="760" y="465" font-family="Inter,Segoe UI,Arial" font-size="26" font-weight="800" fill="#38bdf8">Safety</text>
  <text x="960" y="465" font-family="Inter,Segoe UI,Arial" font-size="30" font-weight="900" fill="#f8fafc">${safety}</text>
  <text x="80" y="575" font-family="Inter,Segoe UI,Arial" font-size="24" fill="#94a3b8">Make your repository ready for AI coding agents and easier for contributors to understand.</text>
</svg>`;
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=300"
    }
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
