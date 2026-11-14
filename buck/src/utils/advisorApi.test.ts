import { beforeEach, describe, expect, it, vi } from "vitest";

const buckAiFetchMock = vi.fn();

vi.mock("@/utils/buckAi", () => ({
  buckAiFetch: (...args: unknown[]) => buckAiFetchMock(...args),
  buckAiError: async (_res: Response, fallback: string) => fallback,
}));

import { fetchAIAdvisorInsights } from "./advisorApi";

describe("advisorApi boundary validation", () => {
  beforeEach(() => {
    buckAiFetchMock.mockReset();
  });

  it("returns valid advisor insights", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestion: "Cut dining out by 10%.",
          advice: "You spent ₱4,500 on dining this month.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await fetchAIAdvisorInsights({ forceRefresh: false });
    expect(result.suggestion).toBe("Cut dining out by 10%.");
    expect(result.advice).toBe("You spent ₱4,500 on dining this month.");
  });

  it("rejects malformed advisor payloads", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ suggestion: 123 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(fetchAIAdvisorInsights({})).rejects.toThrow("Invalid AI advisor payload.");
  });

  it("rejects non-JSON advisor responses cleanly", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response("<html>502</html>", { status: 200, headers: { "Content-Type": "text/html" } })
    );

    await expect(fetchAIAdvisorInsights({})).rejects.toThrow("Invalid AI advisor payload.");
  });
});
