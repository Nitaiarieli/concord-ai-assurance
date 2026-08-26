import { authenticatedEmail } from "@/lib/api-auth";
import { recordAnalyticsEvent } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json();
    await recordAnalyticsEvent(email, {
      eventName: body.eventName,
      route: body.route,
      properties: body.properties,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid analytics event." }, { status: 400 });
  }
}
