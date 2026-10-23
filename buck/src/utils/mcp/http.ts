// CORS for the MCP endpoint and its discovery document. Auth is a bearer
// token (never a cookie), so any origin may call them, which browser-based
// MCP clients and inspectors need.

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  // Authorization is never covered by "*", so name it.
  "Access-Control-Allow-Headers": "Authorization, *",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: Response, cacheControl = "no-store"): Response {
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function corsPreflight(): Response {
  return withCors(new Response(null, { status: 204 }));
}
