import { recordRuntimeHeartbeat } from "@/lib/integration-platform-store";

export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return Response.json({ error: "Runtime authentication required." }, { status: 401 });
  try {
    const result = await recordRuntimeHeartbeat(token, await request.json());
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Heartbeat rejected.";
    const authFailure = /credential|token|expired|revoked/i.test(message);
    return Response.json({ error: message }, { status: authFailure ? 401 : 400 });
  }
}

