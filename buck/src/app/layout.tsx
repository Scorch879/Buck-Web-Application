import type { Metadata } from "next";
import type { ReactNode } from "react";
import SessionManager from "@/component/SessionManager";
import "./globals.css";
import MaintenancePage from "./maintenance-page";

const themeInitScript = `
(() => {
  try {
    const savedTheme = window.localStorage.getItem("buck-landing-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : prefersDark
        ? "dark"
        : "light";
    const root = document.documentElement;
    root.dataset.buckTheme = theme;
    root.classList.toggle("buck-theme-dark", theme === "dark");
    root.classList.toggle("buck-theme-light", theme === "light");
    root.style.backgroundColor = theme === "dark" ? "#120d0a" : "#fff1d8";
    root.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.buckTheme = "light";
    document.documentElement.classList.add("buck-theme-light");
    document.documentElement.style.backgroundColor = "#fff1d8";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;

export const metadata: Metadata = {
  title: "Buck",
  description: "Buck the budget tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const maintenanceMode =
    process.env.MAINTENANCE_MODE === "true" ||
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {maintenanceMode ? (
          <MaintenancePage />
        ) : (
          <>
            <SessionManager />
            {children}
          </>
        )}
      </body>
    </html>
  );
}
