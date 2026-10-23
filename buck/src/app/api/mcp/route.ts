import { createMcpHandler, requireBearerAuth } from "@modelcontextprotocol/server";
import {
  connectedAppTokenVerifier,
  createUserClient,
  getMcpResourceMetadataUrl,
} from "@/utils/mcp/auth";
import { corsPreflight, withCors } from "@/utils/mcp/http";
import { createBuckMcpServer } from "@/utils/mcp/tools";
import { isSupabaseConfigured } from "@/utils/supabaseConfig";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The Buck MCP server (ADR-050): `https://<site>/api/mcp`, Streamable HTTP,
 * stateless (one fresh server per request, nothing kept between calls).
 *
 * Without a valid connected-app token it answers 401 with a
 * `WWW-Authenticate` challenge pointing at
 * `/.well-known/oauth-protected-resource/api/mcp`, from which MCP clients find
 * Supabase's OAuth server, register, and send the user to /oauth/consent.
 */
const handler = createMcpHandler(
  ({ authInfo }) => {
    if (!authInfo) {
      throw new Error("MCP request reached the server without verified auth.");
    }
    return createBuckMcpServer(createUserClient(authInfo.token));
  },
  {
    // No progress or log messages are sent, so plain JSON is enough.
    responseMode: "json",
    onerror: (error) => console.error("MCP:", error.message),
  }
);

async function serve(request: Request) {
  if (!isSupabaseConfigured) {
    return withCors(Response.json({ error: "Buck's MCP server is not configured." }, { status: 503 }));
  }

  const gate = requireBearerAuth({
    verifier: connectedAppTokenVerifier,
    resourceMetadataUrl: getMcpResourceMetadataUrl(new URL(request.url).origin),
  });
  const auth = await gate(request);

  if (auth instanceof Response) {
    return withCors(auth);
  }

  return withCors(await handler.fetch(request, { authInfo: auth }));
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;

export function OPTIONS() {
  return corsPreflight();
}
