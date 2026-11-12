import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, buckAiFetch, from, getUser } = vi.hoisted(() => ({
  rpc: vi.fn(),
  buckAiFetch: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/utils/designPreview", () => ({
  designPreviewUserId: "preview-user",
  isDesignPreviewMode: false,
}));

vi.mock("@/utils/supabase", () => ({
  getSupabaseClient: () => ({
    rpc,
    from,
    auth: { getUser },
  }),
}));

vi.mock("@/utils/buckAi", () => ({
  buckAiFetch,
  buckAiError: vi.fn(),
}));

import { createGoal } from "@/component/goals";
import { detectGoalAttitude } from "./aiApi";
import {
  addGoalProgressRecord,
  deleteGoalRecord,
  restoreGoalRecord,
  setOnlyGoalActiveRecord,
} from "./supabaseData";

const userId = "11111111-1111-4111-8111-111111111111";
const goalId = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  rpc.mockReset();
  buckAiFetch.mockReset();
  from.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
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

describe("deleteGoalRecord", () => {
  it("performs a soft-delete instead of a hard delete", async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const is = vi.fn().mockResolvedValue({ error: null });
    const deleteFn = vi.fn();

    from.mockReturnValue({
      update,
      delete: deleteFn,
      eq,
      is,
    });

    await deleteGoalRecord(goalId);

    expect(from).toHaveBeenCalledWith("goals");
    expect(deleteFn).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      deleted_at: expect.any(String),
      is_active: false,
    });
    expect(eq).toHaveBeenCalledWith("id", goalId);
    expect(eq).toHaveBeenCalledWith("user_id", userId);
    expect(is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("surfaces database errors", async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const is = vi.fn().mockResolvedValue({ error: { message: "Database update failed" } });

    from.mockReturnValue({
      update,
      eq,
      is,
    });

    await expect(deleteGoalRecord(goalId)).rejects.toThrow("Database update failed");
  });
});

describe("restoreGoalRecord", () => {
  it("clears deleted_at, marks inactive and returns the mapped BuckGoal", async () => {
    const row = {
      id: goalId,
      goal_name: "Emergency Fund",
      target_amount: "10000.00",
      current_amount: "2500.00",
      target_date: "2027-01-01",
      created_at: "2026-01-01T00:00:00.000Z",
      attitude: "Moderate",
      attitude_basis: null,
      attitude_detected_at: null,
      is_active: false,
      completed: false,
      ai_recommendation: "Save steadily",
      ai_recommended_budget: 500,
      deleted_at: null,
    };

    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({ data: row, error: null });

    from.mockReturnValue({
      update,
      eq,
      select,
      single,
    });

    const restored = await restoreGoalRecord(goalId);

    expect(from).toHaveBeenCalledWith("goals");
    expect(update).toHaveBeenCalledWith({
      deleted_at: null,
      is_active: false,
    });
    expect(eq).toHaveBeenCalledWith("id", goalId);
    expect(eq).toHaveBeenCalledWith("user_id", userId);
    expect(select).toHaveBeenCalled();
    expect(single).toHaveBeenCalled();
    expect(restored).toEqual({
      id: goalId,
      goalName: "Emergency Fund",
      targetAmount: 10000,
      currentAmount: 2500,
      targetDate: "2027-01-01",
      createdAt: "2026-01-01T00:00:00.000Z",
      attitude: "Moderate",
      attitudeBasis: null,
      attitudeDetectedAt: null,
      isActive: false,
      completed: false,
      aiRecommendation: "Save steadily",
      aiRecommendedBudget: 500,
      deletedAt: null,
    });
  });

  it("surfaces database errors on restore", async () => {
    const update = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "Goal restore failed" } });

    from.mockReturnValue({
      update,
      eq,
      select,
      single,
    });

    await expect(restoreGoalRecord(goalId)).rejects.toThrow("Goal restore failed");
  });
});

describe("createGoal", () => {
  it("saves the goal without waiting for the Gemini tip, then asks for it by id", async () => {
    const detected = {
      attitude: "Moderate",
      goalId: null,
      plan: null,
      window: { spendingDays: 30, incomeDays: 30 },
      reason: "Spend about 10% less.",
      feasible: true,
    };
    buckAiFetch.mockImplementation((path: string) =>
      path === "/advisor/attitude"
        ? Promise.resolve(new Response(JSON.stringify(detected), { status: 200 }))
        : new Promise(() => {}) // the tip never arrives: creating must not wait for it
    );
    const insert = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const single = vi.fn().mockResolvedValue({
      data: {
        id: goalId, goal_name: "Bike", target_amount: "5000.00", current_amount: "0.00",
        target_date: "2027-02-01", created_at: "2026-11-12T00:00:00.000Z", attitude: "Moderate",
        attitude_basis: null, attitude_detected_at: null, is_active: true, completed: false,
        ai_recommendation: "", ai_recommended_budget: null, deleted_at: null,
      },
      error: null,
    });
    from.mockReturnValue({ insert, select, single });

    const result = await createGoal("Bike", "5000", "", "2027-02-01");

    expect(result.success).toBe(true);
    expect(result.goal?.id).toBe(goalId);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ attitude: "Moderate", ai_recommendation: "", is_active: false })
    );
    const tipCall = buckAiFetch.mock.calls.find(([path]) => path === "/advisor/goal-tip");
    expect(JSON.parse(tipCall?.[1].body)).toEqual({ goalId });
  });
});
