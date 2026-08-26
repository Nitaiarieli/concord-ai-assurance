import { authenticatedDisplayName, authenticatedEmail } from "@/lib/api-auth";
import {
  advanceDeploymentAgentRun,
  createDeploymentAgentRun,
  deploymentAgentDossierMarkdown,
  getDeploymentAgentSnapshot,
} from "@/lib/deployment-agent-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  try {
    if (runId && url.searchParams.get("format") === "markdown") {
      const markdown = await deploymentAgentDossierMarkdown(email, runId);
      return new Response(markdown, {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="concord-deployment-dossier-${runId.slice(0, 8)}.md"`,
        },
      });
    }
    return Response.json({ snapshot: await getDeploymentAgentSnapshot(email, authenticatedDisplayName(request) ?? email) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Deployment agent unavailable." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const email = authenticatedEmail(request);
  if (!email) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "start") {
      const run = await createDeploymentAgentRun(email, authenticatedDisplayName(request) ?? email, body.intake, body.requestKey);
      return Response.json({ run }, { status: 201 });
    }
    if (body.action === "advance" && typeof body.runId === "string") {
      return Response.json({ run: await advanceDeploymentAgentRun(email, body.runId) });
    }
    return Response.json({ error: "Unsupported deployment-agent action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid deployment-agent request.";
    return Response.json({ error: message }, { status: /not found/i.test(message) ? 404 : 400 });
  }
}
