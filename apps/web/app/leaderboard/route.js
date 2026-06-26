const leaderboardData = new Map();

export async function GET() {
  const entries = [...leaderboardData.entries()]
    .map(([repo, data]) => ({ repo, ...data }))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 50);
  return Response.json({ entries, total: entries.length, updatedAt: new Date().toISOString() });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const repo = body.repo || "unknown";
    leaderboardData.set(repo, {
      overall: body.overall || 0,
      agentReady: body.agentReady || 0,
      contributorReady: body.contributorReady || 0,
      contextQuality: body.contextQuality || 0,
      safety: body.safety || 0,
      updatedAt: new Date().toISOString()
    });
    return Response.json({ ok: true, repo });
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }
}
