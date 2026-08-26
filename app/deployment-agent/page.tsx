import type { Metadata } from "next";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { DeploymentAgentConsole } from "@/components/deployment-agent-console";
import { getDeploymentAgentSnapshot } from "@/lib/deployment-agent-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Deployment Architecture Agent — Concord",
  description: "Research, score, audit, and document Concord enterprise deployment and integration decisions.",
};

export default async function DeploymentAgentPage() {
  const user = await requireChatGPTUser("/deployment-agent");
  const snapshot = await getDeploymentAgentSnapshot(user.email, user.displayName);
  return <main className="commercial-page deployment-agent-page"><CommercialHeader active="agent"/><DeploymentAgentConsole initialSnapshot={snapshot}/><CommercialFooter/></main>;
}
