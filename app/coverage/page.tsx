import type { Metadata } from "next";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { CoverageExperience } from "@/components/coverage-experience";

export const metadata: Metadata = {
  title: "Enterprise Coverage — Concord",
  description: "How Concord expands across enterprise applications, identity systems, AI libraries, destinations, and retrieval interfaces through one reusable connector contract.",
};

export default function CoveragePage() {
  return <main className="commercial-page coverage-page"><CommercialHeader active="coverage"/><CoverageExperience/><CommercialFooter/></main>;
}

