import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concord — AI State Assurance",
  description:
    "Concord detects, repairs, and proves stale access and content across enterprise AI systems when the source of truth changes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Concord",
    description: "When access changes, your AI should change with it.",
    images: [{ url: "/concord-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Concord",
    description: "When access changes, your AI should change with it.",
    images: ["/concord-og.png"],
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
