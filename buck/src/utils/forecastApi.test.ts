import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const buckAiFetchMock = vi.fn();

vi.mock("@/utils/buckAi", () => ({
  buckAiFetch: (...args: unknown[]) => buckAiFetchMock(...args),
  buckAiError: async (_res: Response, fallback: string) => fallback,
}));

import { explainAIForecast, fetchAIForecastInsights } from "./forecastApi";

describe("forecastApi boundary validation", () => {
  beforeEach(() => {
    buckAiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects malformed JSON payload shapes in explainAIForecast without TypeError crashes", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ forecast: null, narrative: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(explainAIForecast(30)).rejects.toThrow("Invalid forecast payload from Buck_AI.");
  });

  it("rejects invalid JSON text in explainAIForecast cleanly", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response("not-json", { status: 200, headers: { "Content-Type": "text/plain" } })
    );

    await expect(explainAIForecast(30)).rejects.toThrow("Invalid forecast payload from Buck_AI.");
  });

  it("falls back to the validated rule engine when Buck_AI returns malformed JSON", async () => {
    buckAiFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          summary: "Rule forecast summary",
          projectedSavings: 5000,
          warnings: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await fetchAIForecastInsights({ horizon: 30 });
    warnSpy.mockRestore();

    expect(result.source).toBe("rules");
    expect(result.summary).toBe("Rule forecast summary");
    expect(result.projectedSavings).toBe(5000);
  });
});
