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
  FaMoon,
  FaShieldAlt,
  FaSun,
  FaTimes,
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
import { getEmailValidationMessage } from "@/utils/emailValidation";
import {
  getAccountDeletionStatus,
  getUserProfile,
  removeUserAvatar,
  replaceUserAvatar,
  updateUserProfileName,
  type AccountDeletionStatus,
  type BuckProfile,
} from "@/utils/supabaseData";
import { applyDocumentTheme, useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import "./style.css";

const avatarMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxAvatarSizeBytes = 2 * 1024 * 1024;
const fallbackAvatarSource = "/BuckMascot.png";
const privateAvatarSource = "/api/profile/avatar";
const settingsTabs = [
  {
    id: "profile",
    label: "Profile & Account",
    description: "Avatar, display name, and account status.",
    icon: FaUser,
  },
  {
    id: "security",
    label: "Security",
    description: "Email and password controls.",
    icon: FaLock,
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Light and dark dashboard theme.",
    icon: FaSun,
  },
  {
    id: "danger",
    label: "Danger Zone",
    description: "Deletion request and recovery status.",
    icon: FaExclamationTriangle,
  },
] as const;

type SettingsTabId = (typeof settingsTabs)[number]["id"];

function getAvatarFileValidationError(file: File) {
  if (!avatarMimeTypes.has(file.type)) {
    return "Upload a JPG, PNG, or WebP profile picture.";
  }

  if (file.size > maxAvatarSizeBytes) {
    return "Profile picture must be 2 MB or smaller.";
  }

  return "";
}

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
  const documentThemeIsDark = useAuthPageTheme();
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
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTabId>("profile");
  const [isDarkTheme, setIsDarkTheme] = useState(documentThemeIsDark);
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
  const accountEmail = profile?.email || user.email || "";
  const hasAvatar = Boolean(profile?.avatarPath);
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
  const activeSettingsTabDetails =
    settingsTabs.find((tab) => tab.id === activeSettingsTab) ?? settingsTabs[0];
  const ActiveSettingsIcon = activeSettingsTabDetails.icon;

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

        if (!active) {
          return;
        }

        setProfile(loadedProfile);
        setDisplayName(loadedProfile.username || user.displayName || "");
        setEmail(loadedProfile.email || user.email || "");
        setDeletionStatus(loadedDeletionStatus);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            profile: loadedProfile,
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
    setIsDarkTheme(documentThemeIsDark);
  }, [documentThemeIsDark]);

  const clearMessages = () => {
    setNotice("");
    setError("");
  };

  const updateThemePreference = (nextTheme: "dark" | "light") => {
    try {
      window.localStorage.setItem("buck-landing-theme", nextTheme);
    } catch {
      // Theme preference is cosmetic, so private storage failures can be ignored.
    }

    applyDocumentTheme(nextTheme);
    setIsDarkTheme(nextTheme === "dark");
  };

  const openEmailModal = () => {
    clearMessages();
    setEmail(profile?.email || user.email || "");
    setEmailPassword("");
    setEmailModalOpen(true);
  };

  const closeEmailModal = () => {
    if (savingEmail) {
      return;
    }

    setEmailModalOpen(false);
    setEmail(profile?.email || user.email || "");
    setEmailPassword("");
  };

  const openPasswordModal = () => {
    clearMessages();
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalOpen(true);
  };

  const closePasswordModal = () => {
    if (savingPassword) {
      return;
    }

    setPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
    const validationError = getAvatarFileValidationError(file);

    if (validationError) {
      setError(validationError);

      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }

      return;
    }

    setSavingAvatar(true);

    try {
      const nextProfile = await replaceUserAvatar(
        user.uid,
        file,
        profile?.avatarPath
      );

      setProfile(nextProfile);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          profile: nextProfile,
        })
      );
      setNotice("Profile picture updated.");
    } catch (avatarError) {
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
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          profile: nextProfile,
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

    const emailValidationMessage = getEmailValidationMessage(email);
    if (emailValidationMessage) {
      setError(emailValidationMessage);
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
      setEmailModalOpen(false);
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

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordModalOpen(false);
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

      {notice ? (
        <div className="settings-message settings-message--success">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="settings-message settings-message--error">{error}</div>
      ) : null}

      <section className="settings-shell">
        <nav className="settings-tabs" aria-label="Settings sections">
          {settingsTabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeSettingsTab === tab.id;

            return (
              <button
                key={tab.id}
                className={`settings-tab${isActive ? " settings-tab--active" : ""}`}
                type="button"
                onClick={() => setActiveSettingsTab(tab.id)}
                aria-pressed={isActive}
              >
                <TabIcon aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.7rem, 1.4vw, 0.95rem)' }}>
          <div className="settings-account-card">
            <span className="settings-account-icon" aria-hidden="true">
              <FaShieldAlt />
            </span>
            <div>
              <strong>{providerLabel}</strong>
              <span>{accountEmail || "No email on file"}</span>
            </div>
          </div>

          <article className="settings-card settings-card--panel">
            <div className="settings-card-heading settings-card-heading--wide">
            <span aria-hidden="true">
              <ActiveSettingsIcon />
            </span>
            <div>
              <p className="settings-eyebrow">{activeSettingsTabDetails.label}</p>
              <h2>{activeSettingsTabDetails.description}</h2>
            </div>
          </div>

          <div className="settings-tab-panel">
            {activeSettingsTab === "profile" ? (
              <>
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
                      key={profile?.avatarUpdatedAt || profile?.avatarPath || "fallback"}
                      src={hasAvatar ? privateAvatarSource : fallbackAvatarSource}
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
              </>
            ) : null}

            {activeSettingsTab === "security" ? (
              <>
                <section className="settings-section settings-section--email">
                  <div className="settings-section-heading">
                    <FaEnvelope aria-hidden="true" />
                    <div>
                      <p className="settings-eyebrow">Email</p>
                      <h3>Email address</h3>
                    </div>
                  </div>

                  {canManageCredentials ? (
                    <div className="settings-action-panel">
                      <div>
                        <strong>{accountEmail || "No email on file"}</strong>
                        <p>Change requests require your current password.</p>
                      </div>
                      <button
                        className="settings-button settings-button--primary"
                        type="button"
                        onClick={openEmailModal}
                        disabled={isBusy}
                      >
                        Change email
                      </button>
                    </div>
                  ) : (
                    <div className="settings-provider-note">
                      <FaGoogle aria-hidden="true" />
                      <div>
                        <strong>Email is managed by Google.</strong>
                        <p>
                          Sign in with Google controls this account email. Buck
                          keeps your dashboard data tied to the authenticated
                          Google account.
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
                    <div className="settings-action-panel">
                      <div>
                        <strong>Password protected</strong>
                        <p>Open a focused dialog when you need to update it.</p>
                      </div>
                      <button
                        className="settings-button settings-button--primary"
                        type="button"
                        onClick={openPasswordModal}
                        disabled={isBusy}
                      >
                        Change password
                      </button>
                    </div>
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
              </>
            ) : null}

            {activeSettingsTab === "appearance" ? (
              <section className="settings-section settings-section--appearance">
                <div className="settings-section-heading">
                  {isDarkTheme ? (
                    <FaMoon aria-hidden="true" />
                  ) : (
                    <FaSun aria-hidden="true" />
                  )}
                  <div>
                    <p className="settings-eyebrow">Appearance</p>
                    <h3>Theme</h3>
                  </div>
                </div>

                <div className="settings-theme-control" role="group" aria-label="Dashboard theme">
                  <button
                    className={`settings-theme-option${!isDarkTheme ? " settings-theme-option--active" : ""}`}
                    type="button"
                    onClick={() => updateThemePreference("light")}
                    aria-pressed={!isDarkTheme}
                  >
                    <FaSun aria-hidden="true" />
                    Light
                  </button>
                  <button
                    className={`settings-theme-option${isDarkTheme ? " settings-theme-option--active" : ""}`}
                    type="button"
                    onClick={() => updateThemePreference("dark")}
                    aria-pressed={isDarkTheme}
                  >
                    <FaMoon aria-hidden="true" />
                    Dark
                  </button>
                </div>
              </section>
            ) : null}

            {activeSettingsTab === "danger" ? (
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
            ) : null}
          </div>
        </article>
      </div>
    </section>

      {emailModalOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEmailModal();
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-email-modal-title"
          >
            <div className="settings-modal-heading">
              <div>
                <p className="settings-eyebrow">Email security</p>
                <h2 id="settings-email-modal-title">Change email address</h2>
                <p>
                  Buck will send a confirmation email before this change is
                  applied.
                </p>
              </div>
              <button
                className="settings-modal-close"
                type="button"
                onClick={closeEmailModal}
                disabled={savingEmail}
                aria-label="Close email dialog"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form
              className="settings-form settings-modal-form"
              onSubmit={handleEmailSubmit}
            >
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
                <a className="settings-modal-help-link" href="/forgot-password">
                  Forgot current password?
                </a>
              </div>
              <button
                className="settings-button settings-button--primary"
                type="submit"
                disabled={isBusy}
              >
                {savingEmail ? "Sending confirmation..." : "Send confirmation"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {passwordModalOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePasswordModal();
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-password-modal-title"
          >
            <div className="settings-modal-heading">
              <div>
                <p className="settings-eyebrow">Password security</p>
                <h2 id="settings-password-modal-title">Change password</h2>
                <p>
                  Enter your current password first, then choose a stronger new
                  password.
                </p>
              </div>
              <button
                className="settings-modal-close"
                type="button"
                onClick={closePasswordModal}
                disabled={savingPassword}
                aria-label="Close password dialog"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form
              className="settings-form settings-modal-form"
              onSubmit={handlePasswordSubmit}
            >
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
                <a className="settings-modal-help-link" href="/forgot-password">
                  Forgot current password?
                </a>
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
              {newPassword ? (
                <div
                  className={`settings-password-feedback settings-password-feedback--${passwordPolicy.strength}`}
                  aria-live="polite"
                >
                  <div className="settings-password-summary">
                    <strong>{passwordPolicy.label}</strong>
                    <span>{passwordPolicy.score}/5 checks</span>
                  </div>
                  <div className="settings-password-meter" aria-hidden="true">
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
          </section>
        </div>
      ) : null}
    </main>
  );
}
