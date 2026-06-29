import { scanRepoCached } from "../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");
  const force = searchParams.get("force") === "true";
  try {
    const report = await scanRepoCached(repo, { force });
    return Response.json({ ok: true, report });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 400 });
  }
}
