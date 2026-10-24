import { MCP_PATH, buildProtectedResourceMetadata } from "@/utils/mcp/auth";
import { corsPreflight, withCors } from "@/utils/mcp/http";
import { isSupabaseConfigured } from "@/utils/supabaseConfig";

type RouteContext = { params: Promise<{ path?: string[] }> };

/**
 * RFC 9728 Protected Resource Metadata for the Buck MCP server (ADR-050):
 * served at `/.well-known/oauth-protected-resource/api/mcp` (path-aware, the
 * URL the 401 challenge names) and at the bare well-known URL, which some
 * clients try first. It tells MCP clients that Supabase Auth issues tokens.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { path = [] } = await params;
  const suffix = path.length ? `/${path.join("/")}` : "";

  if (!isSupabaseConfigured || (suffix && suffix !== MCP_PATH)) {
    return withCors(Response.json({ error: "Not found." }, { status: 404 }));
  }

  return withCors(
    Response.json(buildProtectedResourceMetadata(new URL(request.url).origin)),
    "public, max-age=3600"
  );
}

export function OPTIONS() {
  return corsPreflight();
}
