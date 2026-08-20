import type { Metadata } from "next";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { ValueDashboard } from "@/components/value-dashboard";

export const metadata: Metadata = { title: "Value & FinOps — Concord", description: "Trace every Concord value claim to its event, formula, assumptions, and supporting evidence." };

export default function ValuePage() { return <main className="commercial-page"><CommercialHeader active="value"/><ValueDashboard/><CommercialFooter/></main>; }
