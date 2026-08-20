import { integrations } from "@/lib/concord";

export async function GET() {
  return Response.json({ demo: true, integrations });
}
