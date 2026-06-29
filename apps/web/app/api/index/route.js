import { readIndex } from "../../lib/repoready-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const index = await readIndex();
  return Response.json(index);
}
