import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
  canRead: true,
  ops: [] as Array<{ table: string; method: string; args: unknown[] }>,
  verify: vi.fn(),
}));

// A stand-in for the Supabase query builder: every call chains, awaiting it
// returns the canned rows for that table. Filters are recorded, not applied.
function fakeDb() {
  return {
    rpc: async () => ({ data: m.canRead, error: null }),
    from(table: string) {
      const rows = () => ({ data: m.tables[table] ?? [], error: null });
      const builder: object = new Proxy(
        {},
        {
          get(_target, prop) {
            if (prop === "then") {
              return (resolve: (value: unknown) => unknown) => Promise.resolve(rows()).then(resolve);
            }
            if (prop === "maybeSingle") {
              return async () => ({ data: (m.tables[table] ?? [])[0] ?? null, error: null });
            }
            return (...args: unknown[]) => {
              m.ops.push({ table, method: String(prop), args });
              return builder;
            };
          },
        }
      );
      return builder;
    },
  };
}

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  supabaseUrl: "https://proj.supabase.co",
  supabaseAnonKey: "anon",
}));
vi.mock("@/utils/mcp/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/mcp/auth")>()),
  connectedAppTokenVerifier: { verifyAccessToken: m.verify },
  createUserClient: () => fakeDb(),
}));

const { POST } = await import("./route");

let nextId = 1;
async function rpc(method: string, params: object = {}, token: string | null = "app-token") {
  const response = await POST(
    new Request("https://buck.test/api/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    })
  );
  return { response, body: response.status === 200 ? readMessage(await response.text()) : null };
}

/** 2025-era stateless replies come as one SSE event; JSON is accepted too. */
function readMessage(text: string) {
  const data = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());
  return JSON.parse(data.length ? data[data.length - 1] : text);
}

async function callTool(name: string, args: object = {}) {
  const { body } = await rpc("tools/call", { name, arguments: args });
  const result = body.result as { isError?: boolean; content: Array<{ text: string }> };
  return { isError: Boolean(result.isError), text: result.content[0].text };
}

const WALLET = "11111111-1111-4111-8111-111111111111";

describe("Buck MCP server (ADR-050)", () => {
  beforeEach(() => {
    m.ops.length = 0;
    m.canRead = true;
    m.verify.mockReset();
    m.verify.mockResolvedValue({
      token: "app-token",
      clientId: "client-1",
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });
    m.tables = {
      profiles: [{ username: "jb", active_wallet_id: WALLET }],
      wallets: [
        { id: WALLET, name: "GCash", budget: 1500.5, deleted_at: null },
        { id: "w-old", name: "Old", budget: 99, deleted_at: "2026-01-01T00:00:00Z" },
      ],
      categories: [
        { id: "c-food", name: "Food", kind: "expense" },
        { id: "c-sal", name: "Salary", kind: "income" },
      ],
      expenses: [
        { id: "e1", amount: 120, category_id: "c-food", category_name: "Food", wallet_id: WALLET, description: "lunch", spent_on: "2026-10-20" },
        { id: "e2", amount: 80.25, category_id: null, category_name: null, wallet_id: WALLET, description: null, spent_on: "2026-10-18" },
      ],
      incomes: [
        { id: "i1", amount: 5000, category_id: "c-sal", source: "Salary", wallet_id: WALLET, description: null, received_on: "2026-10-19" },
      ],
      goals: [
        { goal_name: "Laptop", target_amount: 40000, current_amount: 10000, target_date: "2099-01-01", is_active: true, completed: false, attitude: "Moderate", created_at: "2026-10-01" },
      ],
      ai_advisories: [],
    };
  });

  it("answers 401 with the discovery pointer when there is no token", async () => {
    const { response } = await rpc("tools/list", {}, null);

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://buck.test/.well-known/oauth-protected-resource/api/mcp"'
    );
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("initializes and lists only read-only tools", async () => {
    const init = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(init.body.result.serverInfo.name).toBe("buck");
    expect(init.body.result.instructions).toContain("read-only");

    const { body } = await rpc("tools/list");
    const tools = body.result.tools as Array<{ name: string; annotations?: { readOnlyHint?: boolean } }>;

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_overview",
      "get_saved_advice",
      "list_categories",
      "list_goals",
      "list_transactions",
      "list_wallets",
      "spending_summary",
    ]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("get_overview sums open wallets and this month, in PHP", async () => {
    const { isError, text } = await callTool("get_overview");
    const data = JSON.parse(text);

    expect(isError).toBe(false);
    expect(data.currency).toBe("PHP");
    expect(data.totalBalance).toBe(1500.5); // archived wallet left out
    expect(data.activeWallet).toBe("GCash");
    expect(data.thisMonth).toMatchObject({ spent: 200.25, income: 5000, net: 4799.75, expenseCount: 2 });
    expect(data.thisMonth.topCategories[0]).toMatchObject({ key: "Food", spent: 120 });
    expect(data.activeGoal).toMatchObject({ name: "Laptop", remaining: 30000, progressPercent: 25 });
  });

  it("list_transactions merges both kinds newest first and escapes the search", async () => {
    const { text } = await callTool("list_transactions", { search: "50%_off", limit: 2 });
    const data = JSON.parse(text);

    expect(data.transactions.map((row: { id: string }) => row.id)).toEqual(["e1", "i1"]);
    expect(data.hasMore).toBe(true);
    expect(data.transactions[1]).toMatchObject({ type: "income", category: "Salary", wallet: "GCash" });
    expect(m.ops).toContainEqual({ table: "expenses", method: "ilike", args: ["description", "%50\\%\\_off%"] });
  });

  it("refuses bad periods as a tool error", async () => {
    const backwards = await callTool("spending_summary", { from: "2026-10-10", to: "2026-10-01" });
    expect(backwards).toEqual({ isError: true, text: "`from` must be on or before `to`." });

    const fake = await callTool("spending_summary", { from: "2026-02-30" });
    expect(fake.isError).toBe(true);
  });

  it("tells the agent to reconnect when the 2FA rule blocks the token", async () => {
    m.canRead = false;
    const { isError, text } = await callTool("list_goals");

    expect(isError).toBe(true);
    expect(text).toContain("disconnect this app, then connect it again");
  });

  it("never touches a write method", async () => {
    for (const name of ["get_overview", "list_wallets", "list_categories", "list_goals", "get_saved_advice"]) {
      await callTool(name);
    }
    await callTool("list_transactions", { walletId: WALLET, category: "food" });
    await callTool("spending_summary", { groupBy: "month" });

    const writes = m.ops.filter((op) => ["insert", "update", "upsert", "delete"].includes(op.method));
    expect(writes).toEqual([]);
  });
});
