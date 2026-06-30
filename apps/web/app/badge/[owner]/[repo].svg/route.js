import { readReport, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { owner, repo } = await params;
  let report = await readReport(owner, repo);
  if (!report) {
    try {
      report = await scanRepoCached({ owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` });
    } catch {}
  }

  const score = report?.scores?.agentReady ?? report?.scores?.overall ?? "scan";
  const numeric = Number(score);
  const color = Number.isFinite(numeric)
    ? numeric >= 90 ? "#059669" : numeric >= 75 ? "#2563eb" : numeric >= 60 ? "#d97706" : "#e11d48"
    : "#64748b";
  const value = Number.isFinite(numeric) ? `${numeric} agent-ready` : "scan";
  const width = Number.isFinite(numeric) ? 226 : 158;
  const rightWidth = width - 92;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" role="img" aria-label="RepoReady: ${escapeXml(value)}">
  <linearGradient id="shine" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".02"/></linearGradient>
  <clipPath id="r"><rect width="${width}" height="28" rx="8" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="92" height="28" fill="#0f172a"/>
    <rect x="92" width="${rightWidth}" height="28" fill="${color}"/>
    <rect width="${width}" height="28" fill="url(#shine)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="46" y="18" font-weight="700">RepoReady</text>
    <text x="${92 + rightWidth / 2}" y="18" font-weight="800">${escapeXml(value)}</text>
  </g>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=600" } });
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
