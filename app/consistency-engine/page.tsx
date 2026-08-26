import type { Metadata } from "next";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { ConsistencyEngineLab } from "@/components/consistency-engine-lab";

export const metadata: Metadata = {
  title: "Deterministic Consistency Engine — Concord",
  description: "A runnable, vendor-neutral research prototype for deterministic impact propagation, fail-closed security, remediation, verification, and proof.",
};

export default function ConsistencyEnginePage() {
  return <main className="commercial-page consistency-engine-page"><CommercialHeader active="engine"/><ConsistencyEngineLab/><CommercialFooter/></main>;
}
