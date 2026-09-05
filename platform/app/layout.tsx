import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concord — Change, carried through.",
  description:
    "Keep your AI agents’ data up to date. Explore source changes, connected data updates and verified results in Concord’s local Python demo.",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
