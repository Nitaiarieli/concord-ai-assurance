import { simulateRevocation } from "@/lib/concord";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = simulateRevocation(body);
    return Response.json({ demo: true, plan }, { status: 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request." },
      { status: 400 },
    );
  }
}
