import type { Metadata } from "next";
import { ContactDialog } from "@/components/contact-dialog";
import { SiteMotionController } from "@/components/site-motion-controller";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concord — AI State Assurance",
  description:
    "When authoritative access changes, Concord traces every registered AI-derived artifact affected, repairs invalid state, verifies retrieval, and preserves the evidence.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Concord",
    description: "Trace, repair, verify, and prove registered AI-derived state after authoritative access changes.",
    images: [{ url: "/concord-og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Concord",
    description: "Trace, repair, verify, and prove registered AI-derived state after authoritative access changes.",
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
      <body className="antialiased">{children}<SiteMotionController/><ContactDialog/></body>
    </html>
  );
}
