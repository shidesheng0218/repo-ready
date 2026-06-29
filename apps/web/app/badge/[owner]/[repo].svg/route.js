import { readReport, scanRepoCached } from "../../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { owner, repo } = params;
  let report = await readReport(owner, repo);
  if (!report) {
    try { report = await scanRepoCached({ owner, repo, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` }); } catch {}
  }
  const score = report?.scores?.overall ?? "scan";
  const color = Number(score) >= 90 ? "#10b981" : Number(score) >= 70 ? "#2563eb" : "#f59e0b";
  const label = "RepoReady";
  const value = Number.isFinite(Number(score)) ? `${score}/100` : "scan";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="176" height="28" role="img" aria-label="${label}: ${value}">
  <rect width="176" height="28" rx="8" fill="#0f172a"/>
  <rect x="92" width="84" height="28" rx="8" fill="${color}"/>
  <path d="M92 0h12v28H92z" fill="${color}"/>
  <text x="46" y="18" text-anchor="middle" font-family="Inter,Segoe UI,Arial" font-size="12" font-weight="700" fill="#e5e7eb">${label}</text>
  <text x="134" y="18" text-anchor="middle" font-family="Inter,Segoe UI,Arial" font-size="12" font-weight="800" fill="#fff">${value}</text>
</svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=600" } });
}
