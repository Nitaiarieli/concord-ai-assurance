import type { Metadata } from "next";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { IntegrationControlCenter } from "@/components/integration-control-center";
import { getIntegrationPlatformSnapshot } from "@/lib/integration-platform-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connector Control Center — Concord", description: "Prepare and monitor tenant-scoped customer integration runtimes and normalized connector contracts." };

export default async function WorkspaceIntegrationsPage() {
  const user = await requireChatGPTUser("/workspace/integrations");
  const snapshot = await getIntegrationPlatformSnapshot(user.email, user.displayName);
  return <main className="commercial-page integration-platform-page"><CommercialHeader active="workspace"/><IntegrationControlCenter initialSnapshot={snapshot}/><CommercialFooter/></main>;
}

