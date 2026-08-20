import { authenticatedEmail } from "@/lib/api-auth";
import { applicationProviders, registerApplication } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json();
    if (!applicationProviders.includes(body.provider)) throw new Error("Unsupported application provider.");
    const application = await registerApplication(email, {
      provider: body.provider,
      displayName: body.displayName,
      externalInstanceKey: body.externalInstanceKey,
      environment: body.environment,
    });
    return Response.json({ application }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid application request.";
    const conflict = /UNIQUE|unique/i.test(message);
    return Response.json({ error: conflict ? "This application instance is already registered." : message }, { status: conflict ? 409 : 400 });
  }
}
