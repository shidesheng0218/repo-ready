const LEADERBOARD_URL = "/leaderboard";

export default async function LeaderboardTeaser() {
  let entries = [];
  try {
    const res = await fetch(
      new URL(LEADERBOARD_URL, `http://localhost:${process.env.PORT || 3000}`).href,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      entries = data.entries?.slice(0, 5) || [];
    }
  } catch {
    // leaderboard is optional
  }
  if (!entries.length) return null;
  return (
    <section style={{ marginTop: 28, padding: 22, border: "1px solid #334155", borderRadius: 18, background: "linear-gradient(180deg, #111827 0%, #020617 100%)" }}>
      <h2 style={{ marginTop: 0 }}>Top Repos</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#94a3b8" }}>
            <th style={{ textAlign: "left", padding: "6px 0" }}>Repo</th>
            <th style={{ textAlign: "right", padding: "6px 0" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.repo}>
              <td style={{ padding: "4px 0" }}>{entry.repo}</td>
              <td style={{ textAlign: "right", fontWeight: 800, padding: "4px 0" }}>{entry.overall}/100</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: 12, color: "#94a3b8" }}>Want to see more? Follow the project on GitHub.</p>
    </section>
  );
}
