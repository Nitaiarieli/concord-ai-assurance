import { authenticatedDisplayName, authenticatedEmail } from "@/lib/api-auth";
import { createIntegrationDeployment, getIntegrationPlatformSnapshot } from "@/lib/integration-platform-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const snapshot = await getIntegrationPlatformSnapshot(email, authenticatedDisplayName(request) ?? email);
    return Response.json({ snapshot });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Integration platform unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const result = await createIntegrationDeployment(email, await request.json());
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid integration deployment request.";
    const conflict = /UNIQUE|unique/i.test(message);
    return Response.json({ error: conflict ? "This connector instance is already registered." : message }, { status: conflict ? 409 : 400 });
  }
}

