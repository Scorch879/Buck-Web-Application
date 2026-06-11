"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  FaCamera,
  FaEnvelope,
  FaExclamationTriangle,
  FaGoogle,
  FaLock,
  FaShieldAlt,
  FaTrash,
  FaUndo,
  FaUser,
} from "react-icons/fa";
import {
  updateEmailAddress,
  updatePassword,
  verifyCurrentPassword,
} from "@/component/authentication";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import {
  getAccountDeletionStatus,
  getUserAvatarSignedUrl,
  getUserProfile,
  removeUserAvatar,
  replaceUserAvatar,
  updateUserProfileName,
  type AccountDeletionStatus,
  type BuckProfile,
} from "@/utils/supabaseData";
import "./style.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getProviderLabel(providers: string[]) {
  if (providers.includes("google")) {
    return "Google";
  }

  if (providers.includes("email")) {
    return "Email and password";
  }

  return "Supabase Auth";
}

function getSettingsErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not update account settings.";

  if (
    message.includes("avatar_path") ||
    message.includes("avatar_updated_at") ||
    message.includes("profile-avatars")
  ) {
    return "Run the Supabase profile avatar migration before using profile pictures.";
  }

  return message;
}

async function readActionResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
  };

  return {
    success: Boolean(payload.success && response.ok),
    message: payload.message || "The account action could not be completed.",
  };
}

function formatSettingsDate(value: string | null | undefined) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SettingsPage() {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialSettingsData = Boolean(userCache.profile);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<BuckProfile | null>(
    () => userCache.profile ?? null
  );
  const [deletionStatus, setDeletionStatus] =
    useState<AccountDeletionStatus | null>(
      () => userCache.accountDeletionStatus ?? null
    );
  const [displayName, setDisplayName] = useState(
    () => userCache.profile?.username || user.displayName || ""
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    () => userCache.avatarUrl ?? null
  );
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(
    null
  );
  const [email, setEmail] = useState(
    () => userCache.profile?.email || user.email || ""
  );
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(
    () => !hasInitialSettingsData
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [recoveringAccount, setRecoveringAccount] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const hadInitialSettingsData = useRef(hasInitialSettingsData);

  const providerLabel = getProviderLabel(user.authProviders);
  const canManageCredentials = user.isPasswordUser;
  const passwordPolicy = evaluatePasswordPolicy(newPassword, {
    email,
    username: displayName,
  });
  const passwordProgress = Math.min(100, Math.max(8, passwordPolicy.score * 20));
  const avatarSource =
    localAvatarPreview || avatarUrl || "/BuckMascot.png";
  const accountEmail = profile?.email || user.email || "";
  const hasAvatar = Boolean(profile?.avatarPath || localAvatarPreview);
  const isBusy =
    savingProfile ||
    savingAvatar ||
    savingEmail ||
    savingPassword ||
    requestingDeletion ||
    recoveringAccount;
  const deletionConfirmed = Boolean(
    deletionStatus?.confirmedAt && deletionStatus.recoveryUntil
  );
  const deletionPendingConfirmation = Boolean(
    deletionStatus && !deletionStatus.confirmedAt
  );
  const recoveryUntilLabel = formatSettingsDate(deletionStatus?.recoveryUntil);
  const confirmationExpiresLabel = formatSettingsDate(
    deletionStatus?.confirmationExpiresAt
  );

  const passwordConfirmMessage = useMemo(() => {
    if (!confirmPassword) {
      return "";
    }

    return newPassword === confirmPassword
      ? "Passwords match."
      : "Passwords do not match yet.";
  }, [confirmPassword, newPassword]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!hadInitialSettingsData.current) {
        setLoadingProfile(true);
      }
      setError("");

      try {
        const [loadedProfile, loadedDeletionStatus] = await Promise.all([
          getUserProfile(user.uid),
          getAccountDeletionStatus(user.uid),
        ]);
        const signedAvatarUrl = await getUserAvatarSignedUrl(
          loadedProfile.avatarPath
        );

        if (!active) {
          return;
        }

        setProfile(loadedProfile);
        setDisplayName(loadedProfile.username || user.displayName || "");
        setEmail(loadedProfile.email || user.email || "");
        setAvatarUrl(signedAvatarUrl);
        setDeletionStatus(loadedDeletionStatus);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            profile: loadedProfile,
            avatarUrl: signedAvatarUrl,
            accountDeletionStatus: loadedDeletionStatus,
          })
        );
      } catch (profileError) {
        if (!active) {
          return;
        }

        setError(getSettingsErrorMessage(profileError));
      } finally {
        if (active) {
          setLoadingProfile(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [setDashboardCache, user.displayName, user.email, user.uid]);

  useEffect(() => {
    return () => {
      if (localAvatarPreview) {
        URL.revokeObjectURL(localAvatarPreview);
      }
    };
  }, [localAvatarPreview]);

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const handleProfileSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (savingProfile) {
      return;
    }

    clearMessages();
    setSavingProfile(true);

    try {
      const nextProfile = await updateUserProfileName(user.uid, displayName);
      setProfile(nextProfile);
      setDisplayName(nextProfile.username);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          profile: nextProfile,
        })
      );
      setNotice("Profile details updated.");
    } catch (profileError) {
      setError(getSettingsErrorMessage(profileError));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || savingAvatar) {
      return;
    }

    clearMessages();
    const previewUrl = URL.createObjectURL(file);

    setLocalAvatarPreview((currentPreview) => {
      if (currentPreview) {
        URL.revokeObjectURL(currentPreview);
      }

      return previewUrl;
    });
    setSavingAvatar(true);

    try {
      const nextProfile = await replaceUserAvatar(
        user.uid,
        file,
        profile?.avatarPath
      );
      const signedAvatarUrl = await getUserAvatarSignedUrl(nextProfile.avatarPath);

      setProfile(nextProfile);
      setAvatarUrl(signedAvatarUrl);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          profile: nextProfile,
          avatarUrl: signedAvatarUrl,
        })
      );
      setLocalAvatarPreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return null;
      });
      setNotice("Profile picture updated.");
    } catch (avatarError) {
      setLocalAvatarPreview((currentPreview) => {
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }

        return null;
      });
      setError(getSettingsErrorMessage(avatarError));
    } finally {
      setSavingAvatar(false);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatarPath || savingAvatar) {
      return;
    }

    clearMessages();
    setSavingAvatar(true);

    try {
      const nextProfile = await removeUserAvatar(user.uid, profile.avatarPath);
      setProfile(nextProfile);
      setAvatarUrl(null);
      setLocalAvatarPreview(null);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          profile: nextProfile,
          avatarUrl: null,
        })
      );
      setNotice("Profile picture removed.");
    } catch (avatarError) {
      setError(getSettingsErrorMessage(avatarError));
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canManageCredentials || savingEmail) {
      return;
    }

    clearMessages();

    if (!emailRegex.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setSavingEmail(true);

    try {
      const verification = await verifyCurrentPassword(emailPassword);

      if (!verification.success) {
        setError(verification.message || "Current password is incorrect.");
        return;
      }

      const result = await updateEmailAddress(email);

      if (!result.success) {
        setError(result.message || "Could not request email change.");
        return;
      }

      setEmailPassword("");
      setNotice(
        result.message ||
          "Email change confirmation sent. Check your inbox to finish."
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!canManageCredentials || savingPassword) {
      return;
    }

    clearMessages();

    if (!passwordPolicy.isValid) {
      setError(
        `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const verification = await verifyCurrentPassword(currentPassword);

      if (!verification.success) {
        setError(verification.message || "Current password is incorrect.");
        return;
      }

      const result = await updatePassword(newPassword);

      if (!result.success) {
        setError(result.message || "Could not update password.");
        return;
      }

      setNotice("Password updated. Buck will ask you to sign in again.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeletionRequest = async (event: FormEvent) => {
    event.preventDefault();

    if (requestingDeletion || deletionConfirmed) {
      return;
    }

    clearMessages();

    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to request account deletion.");
      return;
    }

    if (canManageCredentials && !deletePassword) {
      setError("Enter your current password before requesting deletion.");
      return;
    }

    setRequestingDeletion(true);

    try {
      const response = await fetch("/api/account/deletion/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: canManageCredentials ? deletePassword : undefined,
          confirmText: deleteConfirmText,
        }),
      });
      const result = await readActionResponse(response);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setDeletePassword("");
      setDeleteConfirmText("");
      setNotice(result.message);
      const nextDeletionStatus = await getAccountDeletionStatus(user.uid);
      setDeletionStatus(nextDeletionStatus);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          accountDeletionStatus: nextDeletionStatus,
        })
      );
    } finally {
      setRequestingDeletion(false);
    }
  };

  const handleRecoverAccount = async () => {
    if (recoveringAccount || !deletionConfirmed) {
      return;
    }

    clearMessages();
    setRecoveringAccount(true);

    try {
      const response = await fetch("/api/account/deletion/recover", {
        method: "POST",
      });
      const result = await readActionResponse(response);

      if (!result.success) {
        setError(result.message);
        return;
      }

      setNotice(result.message);
      const nextDeletionStatus = await getAccountDeletionStatus(user.uid);
      setDeletionStatus(nextDeletionStatus);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          accountDeletionStatus: nextDeletionStatus,
        })
      );
    } finally {
      setRecoveringAccount(false);
    }
  };

  if (loadingProfile) {
    return <DashboardPageSkeleton variant="settings" />;
  }

  return (
    <main className="settings-page">
      <section className="settings-hero">
        <div>
          <p className="settings-eyebrow">Account settings</p>
          <h1>Keep your Buck profile tidy.</h1>
          <p>
            Manage your display name, profile picture, email, and account
            security from one protected place.
          </p>
        </div>
        <div className="settings-account-card">
          <span className="settings-account-icon" aria-hidden="true">
            <FaShieldAlt />
          </span>
          <div>
            <strong>{providerLabel}</strong>
            <span>{accountEmail || "No email on file"}</span>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="settings-message settings-message--success">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="settings-message settings-message--error">{error}</div>
      ) : null}

      <section className="settings-grid settings-grid--single">
        <article className="settings-card settings-card--account">
          <div className="settings-card-heading settings-card-heading--wide">
            <span aria-hidden="true">
              <FaShieldAlt />
            </span>
            <div>
              <p className="settings-eyebrow">Account controls</p>
              <h2>Profile, security, and recovery</h2>
            </div>
          </div>

          <div className="settings-account-layout">
            <section className="settings-section settings-section--avatar">
              <div className="settings-section-heading">
                <FaCamera aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Profile picture</p>
                  <h3>Avatar</h3>
                </div>
              </div>

              <div className="settings-avatar-panel">
                <img
                  src={avatarSource}
                  alt=""
                  className={`settings-avatar${hasAvatar ? "" : " settings-avatar--fallback"}`}
                />
                <div>
                  <strong>{displayName || "Buck user"}</strong>
                  <p>JPG, PNG, or WebP. Maximum size is 2 MB.</p>
                  <div className="settings-avatar-actions">
                    <label className="settings-button settings-button--secondary">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarChange}
                        disabled={isBusy}
                      />
                      {savingAvatar ? "Uploading..." : "Upload image"}
                    </label>
                    <button
                      className="settings-button settings-button--ghost"
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={!profile?.avatarPath || isBusy}
                    >
                      <FaTrash aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="settings-section settings-section--identity">
              <div className="settings-section-heading">
                <FaUser aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Profile</p>
                  <h3>Display information</h3>
                </div>
              </div>

              <form className="settings-form" onSubmit={handleProfileSubmit}>
                <div className="settings-field">
                  <label htmlFor="settings-display-name">Display name</label>
                  <input
                    id="settings-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Your name"
                    disabled={isBusy}
                  />
                </div>
                <button
                  className="settings-button settings-button--primary"
                  type="submit"
                  disabled={isBusy}
                >
                  {savingProfile ? "Saving..." : "Save profile"}
                </button>
              </form>
            </section>

            <section className="settings-section settings-section--status">
              <div className="settings-section-heading">
                <FaShieldAlt aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Status</p>
                  <h3>Security summary</h3>
                </div>
              </div>

              <dl className="settings-status-list">
                <div>
                  <dt>Provider</dt>
                  <dd>{providerLabel}</dd>
                </div>
                <div>
                  <dt>Email confirmation</dt>
                  <dd>{user.email_confirmed_at ? "Confirmed" : "Pending"}</dd>
                </div>
                <div>
                  <dt>Profile storage</dt>
                  <dd>
                    {profile?.avatarPath ? "Private avatar" : "Default avatar"}
                  </dd>
                </div>
                <div>
                  <dt>Deletion</dt>
                  <dd>
                    {deletionConfirmed
                      ? "Recovery window active"
                      : deletionPendingConfirmation
                        ? "Email pending"
                        : "Not scheduled"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="settings-section settings-section--email">
              <div className="settings-section-heading">
                <FaEnvelope aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Email</p>
                  <h3>Email address</h3>
                </div>
              </div>

              {canManageCredentials ? (
                <form className="settings-form" onSubmit={handleEmailSubmit}>
                  <div className="settings-field">
                    <label htmlFor="settings-email">New email address</label>
                    <input
                      id="settings-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isBusy}
                    />
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-email-password">
                      Current password
                    </label>
                    <input
                      id="settings-email-password"
                      type="password"
                      value={emailPassword}
                      onChange={(event) => setEmailPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="Confirm before changing email"
                      disabled={isBusy}
                    />
                  </div>
                  <button
                    className="settings-button settings-button--primary"
                    type="submit"
                    disabled={isBusy}
                  >
                    {savingEmail ? "Sending confirmation..." : "Change email"}
                  </button>
                </form>
              ) : (
                <div className="settings-provider-note">
                  <FaGoogle aria-hidden="true" />
                  <div>
                    <strong>Email is managed by Google.</strong>
                    <p>
                      Sign in with Google controls this account email. Buck keeps
                      your dashboard data tied to the authenticated Google
                      account.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="settings-section settings-section--security">
              <div className="settings-section-heading">
                <FaLock aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Security</p>
                  <h3>Password</h3>
                </div>
              </div>

              {canManageCredentials ? (
                <form className="settings-form" onSubmit={handlePasswordSubmit}>
                  <div className="settings-field-row">
                    <div className="settings-field">
                      <label htmlFor="settings-current-password">
                        Current password
                      </label>
                      <input
                        id="settings-current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(event) =>
                          setCurrentPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="settings-new-password">New password</label>
                      <input
                        id="settings-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        autoComplete="new-password"
                        disabled={isBusy}
                      />
                    </div>
                    <div className="settings-field">
                      <label htmlFor="settings-confirm-password">
                        Confirm password
                      </label>
                      <input
                        id="settings-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        disabled={isBusy}
                      />
                    </div>
                  </div>
                  {newPassword ? (
                    <div
                      className={`settings-password-feedback settings-password-feedback--${passwordPolicy.strength}`}
                      aria-live="polite"
                    >
                      <div className="settings-password-summary">
                        <strong>{passwordPolicy.label}</strong>
                        <span>{passwordPolicy.score}/5 checks</span>
                      </div>
                      <div
                        className="settings-password-meter"
                        aria-hidden="true"
                      >
                        <span style={{ width: `${passwordProgress}%` }} />
                      </div>
                      {passwordPolicy.issues.length ? (
                        <p>{passwordPolicy.issues.join(", ")}</p>
                      ) : (
                        <p>Your password meets Buck&apos;s requirements.</p>
                      )}
                    </div>
                  ) : null}
                  {passwordConfirmMessage ? (
                    <p
                      className={`settings-confirm-hint${
                        newPassword === confirmPassword
                          ? " settings-confirm-hint--match"
                          : ""
                      }`}
                    >
                      {passwordConfirmMessage}
                    </p>
                  ) : null}
                  <button
                    className="settings-button settings-button--primary"
                    type="submit"
                    disabled={isBusy}
                  >
                    {savingPassword ? "Updating..." : "Update password"}
                  </button>
                </form>
              ) : (
                <div className="settings-provider-note">
                  <FaGoogle aria-hidden="true" />
                  <div>
                    <strong>Password is managed by Google.</strong>
                    <p>
                      Use your Google account settings to manage password and
                      sign-in security for this Buck account.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="settings-section settings-section--danger">
              <div className="settings-section-heading">
                <FaExclamationTriangle aria-hidden="true" />
                <div>
                  <p className="settings-eyebrow">Danger zone</p>
                  <h3>Delete account</h3>
                </div>
              </div>

              {deletionConfirmed ? (
                <div className="settings-recovery-panel">
                  <div>
                    <strong>Account deletion is scheduled.</strong>
                    <p>
                      You can recover this account until {recoveryUntilLabel}.
                      After that, Buck can permanently erase the account and
                      budget data.
                    </p>
                  </div>
                  <button
                    className="settings-button settings-button--secondary"
                    type="button"
                    onClick={handleRecoverAccount}
                    disabled={isBusy}
                  >
                    <FaUndo aria-hidden="true" />
                    {recoveringAccount ? "Recovering..." : "Recover account"}
                  </button>
                </div>
              ) : (
                <form
                  className="settings-form settings-delete-form"
                  onSubmit={handleDeletionRequest}
                >
                  <p>
                    Buck sends a confirmation email first. After confirmation,
                    your account enters a 10-day recovery window before the
                    scheduled purge can permanently erase it.
                  </p>
                  {deletionPendingConfirmation ? (
                    <p className="settings-confirm-hint">
                      A deletion confirmation email is pending until{" "}
                      {confirmationExpiresLabel}.
                    </p>
                  ) : null}
                  <div className="settings-field-row settings-field-row--delete">
                    {canManageCredentials ? (
                      <div className="settings-field">
                        <label htmlFor="settings-delete-password">
                          Current password
                        </label>
                        <input
                          id="settings-delete-password"
                          type="password"
                          value={deletePassword}
                          onChange={(event) =>
                            setDeletePassword(event.target.value)
                          }
                          autoComplete="current-password"
                          disabled={isBusy}
                        />
                      </div>
                    ) : null}
                    <div className="settings-field">
                      <label htmlFor="settings-delete-confirm">
                        Type DELETE
                      </label>
                      <input
                        id="settings-delete-confirm"
                        value={deleteConfirmText}
                        onChange={(event) =>
                          setDeleteConfirmText(event.target.value)
                        }
                        placeholder="DELETE"
                        disabled={isBusy}
                      />
                    </div>
                    <button
                      className="settings-button settings-button--danger"
                      type="submit"
                      disabled={isBusy}
                    >
                      {requestingDeletion
                        ? "Sending confirmation..."
                        : "Request deletion"}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
