import type { Metadata } from "next";
import { ContactDialog } from "@/components/contact-dialog";
import { SiteMotionController } from "@/components/site-motion-controller";
import "./globals.css";
import "./visual-reset.css";

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
  },
  twitter: {
    card: "summary_large_image",
    title: "Concord",
    description: "Trace, repair, verify, and prove registered AI-derived state after authoritative access changes.",
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
