import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, range } = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn() }));

vi.mock("@/utils/designPreview", () => ({
  designPreviewUserId: "preview-user",
  isDesignPreviewMode: false,
}));

vi.mock("@/utils/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    range,
  };
  return {
    getSupabaseClient: () => ({ from: () => chain, rpc }),
  };
});

import { clearDataCache } from "./dataCache";
import { addIncome, deleteIncome, listIncomes } from "./supabaseData";

const userId = "11111111-1111-4111-8111-111111111111";
const walletId = "22222222-2222-4222-8222-222222222222";
const incomeId = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  clearDataCache();
  rpc.mockReset();
  range.mockReset();
});

describe("listIncomes", () => {
  it("maps rows and pages past the 1000-row cap", async () => {
    const row = (index: number) => ({
      id: `id-${index}`,
      wallet_id: null,
      source: "Salary",
      amount: "100.50",
      description: "",
      received_on: "2026-10-01",
      created_at: "2026-10-01T00:00:00Z",
    });
    range
      .mockResolvedValueOnce({
        data: Array.from({ length: 1000 }, (_, i) => row(i)),
        error: null,
      })
      .mockResolvedValueOnce({ data: [row(1000)], error: null });

    const incomes = await listIncomes(userId);

    expect(incomes).toHaveLength(1001);
    expect(incomes?.[0]).toMatchObject({
      amount: 100.5,
      date: "2026-10-01",
      source: "Salary",
    });
    expect(range).toHaveBeenCalledTimes(2);
  });

  it.each(["PGRST205", "PGRST202", "42P01"])(
    "returns null (not tracked) when the table is missing (%s)",
    async (code) => {
      range.mockResolvedValueOnce({
        data: null,
        error: { code, message: "missing" },
      });
      expect(await listIncomes(userId)).toBeNull();
    }
  );

  it("throws on other errors", async () => {
    range.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "denied" },
    });
    await expect(listIncomes(userId)).rejects.toThrow("denied");
  });

  it("rejects a malformed since date", async () => {
    await expect(listIncomes(userId, { since: "yesterday" })).rejects.toThrow();
  });
});

describe("addIncome", () => {
  it("calls add_income_atomic with the shared RPC parameters", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        income_id: incomeId,
        wallet_id: walletId,
        amount: 500,
        wallet_balance: 1500,
      },
      error: null,
    });

    const result = await addIncome(userId, {
      walletId,
      amount: 500,
      source: "Gift",
      description: " birthday ",
      date: "2026-10-12",
    });

    expect(rpc).toHaveBeenCalledWith("add_income_atomic", {
      p_wallet_id: walletId,
      p_amount: 500,
      p_source: "Gift",
      p_description: "birthday",
      p_received_on: "2026-10-12",
    });
    expect(result).toEqual({
      incomeId,
      walletId,
      amount: 500,
      walletBalance: 1500,
    });
  });

  it("rejects non-positive amounts and bad dates before calling the RPC", async () => {
    await expect(
      addIncome(userId, {
        walletId,
        amount: 0,
        source: "Other",
        date: "2026-10-12",
      })
    ).rejects.toThrow();
    await expect(
      addIncome(userId, {
        walletId,
        amount: 10,
        source: "Other",
        date: "12/10/2026",
      })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the RPC is missing", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST202", message: "no fn" },
    });
    await expect(
      addIncome(userId, {
        walletId,
        amount: 10,
        source: "Other",
        date: "2026-10-12",
      })
    ).rejects.toThrow("Income tracking is not available yet.");
  });
});

describe("deleteIncome", () => {
  it("calls delete_income_atomic", async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    await deleteIncome(userId, incomeId);
    expect(rpc).toHaveBeenCalledWith("delete_income_atomic", {
      p_income_id: incomeId,
    });
  });

  it("validates the income id", async () => {
    await expect(deleteIncome(userId, "not-a-uuid")).rejects.toThrow(
      "Invalid income id."
    );
  });
});
