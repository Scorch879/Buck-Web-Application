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
  FaGoogle,
  FaLock,
  FaShieldAlt,
  FaTrash,
  FaUser,
} from "react-icons/fa";
import {
  updateEmailAddress,
  updatePassword,
  verifyCurrentPassword,
} from "@/component/authentication";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import {
  getUserAvatarSignedUrl,
  getUserProfile,
  removeUserAvatar,
  replaceUserAvatar,
  updateUserProfileName,
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

export default function SettingsPage() {
  const { user } = useDashboardUser();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<BuckProfile | null>(null);
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(
    null
  );
  const [email, setEmail] = useState(user.email || "");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

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
    savingProfile || savingAvatar || savingEmail || savingPassword;

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
      setLoadingProfile(true);
      setError("");

      try {
        const loadedProfile = await getUserProfile(user.uid);
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
  }, [user.displayName, user.email, user.uid]);

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

      <section className="settings-grid">
        <article className="settings-card settings-card--profile">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaCamera />
            </span>
            <div>
              <p className="settings-eyebrow">Profile picture</p>
              <h2>Avatar</h2>
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
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaUser />
            </span>
            <div>
              <p className="settings-eyebrow">Profile</p>
              <h2>Display information</h2>
            </div>
          </div>

          <form className="settings-form" onSubmit={handleProfileSubmit}>
            <label htmlFor="settings-display-name">Display name</label>
            <input
              id="settings-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              disabled={isBusy}
            />
            <button
              className="settings-button settings-button--primary"
              type="submit"
              disabled={isBusy}
            >
              {savingProfile ? "Saving..." : "Save profile"}
            </button>
          </form>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaEnvelope />
            </span>
            <div>
              <p className="settings-eyebrow">Email</p>
              <h2>Email address</h2>
            </div>
          </div>

          {canManageCredentials ? (
            <form className="settings-form" onSubmit={handleEmailSubmit}>
              <label htmlFor="settings-email">New email address</label>
              <input
                id="settings-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isBusy}
              />
              <label htmlFor="settings-email-password">Current password</label>
              <input
                id="settings-email-password"
                type="password"
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Confirm before changing email"
                disabled={isBusy}
              />
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
                  your dashboard data tied to the authenticated Google account.
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaLock />
            </span>
            <div>
              <p className="settings-eyebrow">Security</p>
              <h2>Password</h2>
            </div>
          </div>

          {canManageCredentials ? (
            <form className="settings-form" onSubmit={handlePasswordSubmit}>
              <label htmlFor="settings-current-password">Current password</label>
              <input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                disabled={isBusy}
              />
              <label htmlFor="settings-new-password">New password</label>
              <input
                id="settings-new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                disabled={isBusy}
              />
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
              <label htmlFor="settings-confirm-password">Confirm password</label>
              <input
                id="settings-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={isBusy}
              />
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
                  Use your Google account settings to manage password and sign-in
                  security for this Buck account.
                </p>
              </div>
            </div>
          )}
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaShieldAlt />
            </span>
            <div>
              <p className="settings-eyebrow">Account status</p>
              <h2>Security summary</h2>
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
              <dd>{profile?.avatarPath ? "Private avatar active" : "Default avatar"}</dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}
