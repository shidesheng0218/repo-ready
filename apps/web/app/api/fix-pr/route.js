import { createFixPullRequest, recordEvent } from "../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createFixPullRequest({ repoInput: body.repo, installationId: body.installationId });
    return Response.json(result, { status: result.ok ? 200 : 202 });
  } catch (error) {
    await recordEvent("fix_pr_failed", { error: error.message });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
