import { demoScenarios, runConsistencyDemo } from "@/lib/consistency-engine/demo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { scenario?: string };
    if (!body.scenario || !demoScenarios.includes(body.scenario as (typeof demoScenarios)[number])) {
      return Response.json({ error: "Unsupported deterministic scenario." }, { status: 400 });
    }
    return Response.json(await runConsistencyDemo(body.scenario as (typeof demoScenarios)[number]));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Consistency demo failed." }, { status: 400 });
  }
}
