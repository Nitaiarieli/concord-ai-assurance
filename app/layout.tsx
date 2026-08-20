import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concord — AI State Assurance",
  description:
    "Trace, reconcile, and prove access-state changes across registered enterprise AI systems.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Concord",
    description: "Trust the state after the source changes.",
    images: [{ url: "/concord-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Concord",
    description: "Trust the state after the source changes.",
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
