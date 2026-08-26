import type { Metadata } from "next";
import { CommercialFooter, CommercialHeader } from "@/components/commercial-header";
import { WorkspaceConsole } from "@/components/workspace-console";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getWorkspaceSnapshot } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspace — Concord", description: "Connect applications, inspect protected identities, understand billing, and trace value evidence." };

export default async function WorkspacePage() {
  const user = await requireChatGPTUser("/workspace");
  const snapshot = await getWorkspaceSnapshot(user.email, user.displayName);
  return <main className="commercial-page workspace-page"><CommercialHeader active="workspace"/><WorkspaceConsole initialSnapshot={snapshot} displayName={user.displayName}/><CommercialFooter/></main>;
}
