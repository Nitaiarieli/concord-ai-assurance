export function authenticatedEmail(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return email || null;
}

export function authenticatedDisplayName(request: Request) {
  const encoded = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (!encoded || encoding !== "percent-encoded-utf-8") return authenticatedEmail(request);
  try { return decodeURIComponent(encoded); } catch { return authenticatedEmail(request); }
}
