import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FİT N STOP | Yönetim Paneli",
  description: "FİT N STOP üye ve salon yönetim paneli.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
