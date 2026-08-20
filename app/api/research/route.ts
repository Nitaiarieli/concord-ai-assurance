import { crunchbaseScope, mainstreamCompetitors, radarCompanies, researchCutoff } from "@/lib/research";

export async function GET() {
  return Response.json({ asOf: researchCutoff, crunchbase: crunchbaseScope, mainstreamCompetitors, radarCompanies });
}
