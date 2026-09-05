import type { Metadata } from "next";
import "./globals.css";
import "./automatic.css";
import "./enterprise.css";

export const metadata: Metadata = {
  title: "Concord — Keep your agent data up to date.",
  description:
    "Keep your agents’ data up to date across enterprise applications. Explore Concord’s Atlassian-first product mockup and source-ingestion backend.",
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
