import { commercialRecommendation } from "@/lib/research";
import { connectedApplicationPolicy } from "@/lib/commercial";

export async function GET() {
  return Response.json({
    status: "awaiting_founder_approval",
    firstApplicationFeeMinor: 0,
    message: "Your first application is free.",
    metric: commercialRecommendation.metric,
    policy: connectedApplicationPolicy,
    approvedRates: null,
    note: "No draft or unapproved monetary rates are exposed by this public endpoint.",
  });
}
