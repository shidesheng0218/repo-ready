export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const score = searchParams.get("score") || "ready";
  const label = "RepoReady";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="20" role="img" aria-label="${label}: ${score}"><linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient><clipPath id="r"><rect width="150" height="20" rx="3" fill="#fff"/></clipPath><g clip-path="url(#r)"><rect width="82" height="20" fill="#555"/><rect x="82" width="68" height="20" fill="#2563eb"/><rect width="150" height="20" fill="url(#s)"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="41" y="15">${label}</text><text x="116" y="15">${score}</text></g></svg>`;
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" } });
}
