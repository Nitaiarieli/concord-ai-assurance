import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concord — AI State Assurance",
  description:
    "Keep enterprise AI aligned with the truth. Concord traces, reconciles, and verifies registered AI-derived state when authoritative data changes.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Concord",
    description: "Keep enterprise AI aligned with the truth.",
    images: [{ url: "/concord-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Concord",
    description: "Keep enterprise AI aligned with the truth.",
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
