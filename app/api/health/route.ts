export async function GET() {
  return Response.json({
    status: "ready",
    mode: "public-product-simulation",
    externalConnectors: "not-configured",
    persistence: "none",
  });
}
