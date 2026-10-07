import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FİT N STOP | Spor Salonu Uygulaması",
  description: "Randevu, QR giriş ve antrenman takibini tek uygulamada buluşturan FİT N STOP üye uygulaması.",
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
