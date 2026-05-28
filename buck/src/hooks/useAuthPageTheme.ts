import { useEffect, useState } from "react";

type LandingTheme = "dark" | "light";

export type PointerPosition = {
  x: number;
  y: number;
} | null;

const LANDING_THEME_STORAGE_KEY = "buck-landing-theme";
const DARK_AUTH_BUTTON = "linear-gradient(135deg, #f47536 0%, #ff8d3d 100%)";
const LIGHT_AUTH_BUTTON = "linear-gradient(135deg, #f47536 0%, #ff3838 100%)";

const getStoredLandingTheme = (): LandingTheme | null => {
  try {
    const savedTheme = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY);

    return savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : null;
  } catch {
    return null;
  }
};

const resolveLandingTheme = (
  mediaQuery: MediaQueryList | undefined
): LandingTheme =>
  getStoredLandingTheme() ?? (mediaQuery?.matches ? "dark" : "light");

export function useAuthPageTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    const updateThemeFromPreference = () => {
      setIsDarkTheme(resolveLandingTheme(mediaQuery) === "dark");
    };

    updateThemeFromPreference();
    window.addEventListener("storage", updateThemeFromPreference);
    mediaQuery?.addEventListener("change", updateThemeFromPreference);

    return () => {
      window.removeEventListener("storage", updateThemeFromPreference);
      mediaQuery?.removeEventListener("change", updateThemeFromPreference);
    };
  }, []);

  return isDarkTheme;
}

export function getAuthButtonBackground(
  isDarkTheme: boolean,
  pointer: PointerPosition
) {
  const baseGradient = isDarkTheme ? DARK_AUTH_BUTTON : LIGHT_AUTH_BUTTON;

  if (!pointer) {
    return baseGradient;
  }

  const glow = isDarkTheme
    ? "rgba(255, 232, 163, 0.58) 0%, rgba(255, 197, 71, 0.52) 22%, rgba(255, 197, 71, 0) 50%"
    : "rgba(255, 240, 200, 0.88) 0%, rgba(255, 197, 71, 0.68) 22%, rgba(255, 197, 71, 0) 48%";

  return `radial-gradient(circle at ${pointer.x}px ${pointer.y}px, ${glow}), ${baseGradient}`;
}
