import { authenticatedDisplayName, authenticatedEmail } from "@/lib/api-auth";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const snapshot = await getWorkspaceSnapshot(email, authenticatedDisplayName(request) ?? email);
    return Response.json({ snapshot });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Workspace unavailable." }, { status: 500 });
  }
}
