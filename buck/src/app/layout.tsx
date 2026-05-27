import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import MaintenancePage from "./maintenance-page";

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
    <html lang="en">
      <body>{maintenanceMode ? <MaintenancePage /> : children}</body>
    </html>
  );
}
