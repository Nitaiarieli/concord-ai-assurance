"use client";
import {
  Layers3,
  Network,
  Plug,
  FileCheck2,
  Globe2,
  ArrowUpRight,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Mark } from "./primitives";
import type { View } from "./workspace";
const views = [
  { id: "overview", label: "Overview", icon: Layers3 },
  { id: "review", label: "Change review", icon: Network },
  { id: "coverage", label: "Coverage", icon: Plug },
  { id: "evidence", label: "Evidence", icon: FileCheck2 },
] as const;
export default function Nav({
  view,
  onView,
}: {
  view: View;
  onView: (v: View) => void;
}) {
  const { setOpenMobile } = useSidebar();
  const go = (v: View) => {
    onView(v);
    setOpenMobile(false);
  };
  return (
    <Sidebar className="concord-sidebar">
      <SidebarHeader className="brand-area">
        <button
          className="brand"
          onClick={() => go("overview")}
          aria-label="Concord overview"
        >
          <Mark />
          <span>
            concord<span className="brand-period">.</span>
          </span>
        </button>
      </SidebarHeader>
      <SidebarContent>
        <div className="workspace-switch">
          <span className="workspace-emblem">N</span>
          <div>
            <strong>Nitai’s workspace</strong>
            <small>Sample workspace</small>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <SidebarMenu>
          {views.map(({ id, label, icon: Icon }) => (
            <SidebarMenuItem key={id}>
              <SidebarMenuButton
                className="nav-item"
                isActive={view === id}
                onClick={() => go(id)}
              >
                <Icon />
                <span>{label}</span>
                
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        <div className="nav-separator" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="nav-item"
              isActive={view === "brief"}
              onClick={() => go("brief")}
            >
              <Globe2 />
              <span>Product brief</span>
              <ArrowUpRight className="nav-external" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="sidebar-note c-sidebar-nature">
          <img src="/assets/concord-evidence-balanced-stones.webp" alt="" />
          <p>Small changes.<br /><em>Visible consequences.</em></p>
        </div>
        <div className="profile">
          <div className="avatar">NA</div>
          <div>
            <strong>Nitai Arieli</strong>
            <small>Founder workspace</small>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
