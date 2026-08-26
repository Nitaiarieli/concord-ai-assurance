import type { Metadata } from "next";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { PricingExperience } from "@/components/pricing-experience";

export const metadata: Metadata = { title: "Pricing — Concord", description: "Connect your first application for free, then expand with transparent application and protected-user pricing." };

export default function PricingPage() {
  return <main className="commercial-page"><CommercialHeader active="pricing"/><PricingExperience/><CommercialFooter/></main>;
}
