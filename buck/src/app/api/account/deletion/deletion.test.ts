import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const sendCancellationEmailMock = vi.fn();
const sendConfirmationEmailMock = vi.fn();
const isSmtpConfiguredMock = vi.fn();

vi.mock("@/utils/mailer", () => ({
  isSmtpConfigured: isSmtpConfiguredMock,
  sendAccountDeletionAutoCanceledEmail: sendCancellationEmailMock,
  sendAccountDeletionConfirmationEmail: sendConfirmationEmailMock,
}));

const getRequestAuthMock = vi.fn();
vi.mock("@/utils/apiAuth", () => ({
  getRequestAuth: getRequestAuthMock,
  mfaRequiredResponse: () =>
    new Response(JSON.stringify({ error: "mfa_required" }), { status: 401 }),
}));

vi.mock("@/utils/supabaseConfig", () => ({
  isSupabaseConfigured: true,
  isSupabaseAdminConfigured: true,
}));

let adminClientMock: Record<string, unknown> = {};
vi.mock("@/utils/supabase/admin", () => ({
  createSupabaseAdminClient: () => adminClientMock,
}));

const { processLoginDeletionAutoCancel, dismissAutoCancelNotice } = await import(
  "@/utils/accountDeletion"
);
const { POST: checkLoginRecoveryPost, DELETE: checkLoginRecoveryDelete } =
  await import("./check-login-recovery/route");

describe("account deletion login auto-cancel & notice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSmtpConfiguredMock.mockReturnValue(true);
    sendCancellationEmailMock.mockResolvedValue(true);
  });

  it("cancels an active 10-day deletion when signing in and sends email", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    const scheduledRow = {
      id: "req-1",
      email: "googleuser@gmail.com",
      recovery_until: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      canceled_at: null,
      cancellation_email_sent_at: null,
    };

    const mockAdmin = {
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {};
        let isUpdate = false;
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.not = vi.fn(() => chain);
        chain.is = vi.fn(() => chain);
        chain.order = vi.fn(() => chain);
        chain.limit = vi.fn(() => chain);
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          isUpdate = true;
          updateCalls.push(payload);
          return chain;
        });
        chain.maybeSingle = vi.fn(async () => {
          if (isUpdate) {
            return {
              data: {
                ...scheduledRow,
                canceled_at: "2026-11-16T08:00:00.000Z",
              },
              error: null,
            };
          }
          return { data: scheduledRow, error: null };
        });
        return chain;
      }),
    };

    const result = await processLoginDeletionAutoCancel(
      mockAdmin as never,
      {
        userId: "user-1",
        email: "googleuser@gmail.com",
        username: "Google User",
      }
    );

    expect(result.autoCanceled).toBe(true);
    expect(result.notice).toMatchObject({
      id: "req-1",
      canceledAt: "2026-11-16T08:00:00.000Z",
      emailSent: true,
    });
    expect(updateCalls[0]).toMatchObject({
      auto_canceled_on_login: true,
      cancel_reason: "user_login",
    });
    expect(sendCancellationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendCancellationEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "googleuser@gmail.com",
        username: "Google User",
      })
    );
  });

  it("returns 401 when unauthenticated on POST /api/account/deletion/check-login-recovery", async () => {
    getRequestAuthMock.mockResolvedValue(null);
    const res = await checkLoginRecoveryPost(
      new NextRequest("http://localhost:3000/api/account/deletion/check-login-recovery", {
        method: "POST",
      })
    );
    expect(res.status).toBe(401);
  });

  it("dismisses notice via DELETE /api/account/deletion/check-login-recovery", async () => {
    getRequestAuthMock.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com", user_metadata: {} },
      mfa: { satisfied: true },
    });
    const updates: Array<Record<string, unknown>> = [];
    adminClientMock = {
      from: vi.fn(() => {
        const chain: Record<string, unknown> = {
          update: vi.fn((payload: Record<string, unknown>) => {
            updates.push(payload);
            return chain;
          }),
          eq: vi.fn(() => chain),
          is: vi.fn(() => chain),
          then: (resolve: (val: { error: null }) => void) =>
            resolve({ error: null }),
        };
        return chain;
      }),
    };

    await dismissAutoCancelNotice(adminClientMock as never, "user-1", "req-1");
    expect(updates[0]).toHaveProperty("auto_cancel_notice_dismissed_at");

    const res = await checkLoginRecoveryDelete(
      new NextRequest("http://localhost:3000/api/account/deletion/check-login-recovery", {
        method: "DELETE",
        body: JSON.stringify({ noticeId: "req-1" }),
      })
    );
    expect(res.status).toBe(200);
  });
});
