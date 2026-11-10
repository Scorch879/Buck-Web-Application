import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, buckAiFetch } = vi.hoisted(() => ({ rpc: vi.fn(), buckAiFetch: vi.fn() }));

vi.mock("@/utils/designPreview", () => ({
  designPreviewUserId: "preview-user",
  isDesignPreviewMode: false,
}));

vi.mock("@/utils/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

vi.mock("@/utils/buckAi", () => ({
  buckAiFetch,
  buckAiError: vi.fn(),
}));

import { detectGoalAttitude } from "./aiApi";
import { addGoalProgressRecord, setOnlyGoalActiveRecord } from "./supabaseData";

const goalId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  rpc.mockReset();
  buckAiFetch.mockReset();
});

describe("setOnlyGoalActiveRecord", () => {
  it("switches the active goal in one database call", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await setOnlyGoalActiveRecord(goalId);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("set_active_goal", { p_goal_id: goalId });
  });

  it("surfaces the database error (e.g. a completed goal)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Goal not found or already completed" } });
    await expect(setOnlyGoalActiveRecord(goalId)).rejects.toThrow("already completed");
  });

  it("rejects a malformed id before calling the database", async () => {
    await expect(setOnlyGoalActiveRecord("nope")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("addGoalProgressRecord", () => {
  it("adds in the database and returns the new state", async () => {
    rpc.mockResolvedValue({ data: [{ current_amount: "5000.00", completed: true, is_active: false }], error: null });
    const result = await addGoalProgressRecord(goalId, 1234.567);
    expect(rpc).toHaveBeenCalledWith("add_goal_progress", { p_goal_id: goalId, p_amount: 1234.57 });
    expect(result).toEqual({ currentAmount: 5000, completed: true, isActive: false });
  });

  it("refuses zero, negative and non-numeric amounts", async () => {
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(addGoalProgressRecord(goalId, amount)).rejects.toThrow("more than 0");
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("detectGoalAttitude", () => {
  const detected = {
    attitude: "Moderate",
    reason: "To save ₱50.00 a day by Jan 10, 2027, spend about 17% less than your usual ₱300.00 a day.",
    plan: { spending: { perDay: 240, perWeek: 1680, perMonth: 7200 } },
  };

  it("previews a new goal", async () => {
    buckAiFetch.mockResolvedValue(new Response(JSON.stringify(detected), { status: 200 }));
    const result = await detectGoalAttitude({ targetAmount: "3000", targetDate: "2027-01-10" });
    expect(result?.attitude).toBe("Moderate");
    const [path, init] = buckAiFetch.mock.calls[0];
    expect(path).toBe("/advisor/attitude");
    expect(JSON.parse(init.body)).toEqual({ targetAmount: 3000, savedAmount: 0, targetDate: "2027-01-10" });
  });

  it("sends only the id for a saved goal", async () => {
    buckAiFetch.mockResolvedValue(new Response(JSON.stringify(detected), { status: 200 }));
    await detectGoalAttitude({ goalId });
    expect(JSON.parse(buckAiFetch.mock.calls[0][1].body)).toEqual({ goalId });
  });

  it("returns null when Buck_AI is down or answers nonsense", async () => {
    buckAiFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    expect(await detectGoalAttitude({ goalId })).toBeNull();
    buckAiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ attitude: "Wild" }), { status: 200 }));
    expect(await detectGoalAttitude({ goalId })).toBeNull();
    buckAiFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await detectGoalAttitude({ goalId })).toBeNull();
  });
});
