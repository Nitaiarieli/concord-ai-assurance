import { readinessReport } from "@/lib/concord";

export async function GET() {
  return Response.json({ demo: true, report: readinessReport });
}
