import type { Metadata } from "next";
import "./globals.css";
import "./signup/signup.css";

export const metadata: Metadata = {
  title: "Buck",
  description: "Buck the budget tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
