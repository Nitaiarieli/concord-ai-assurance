"use client";
import {
  BookOpen,
  FileText,
  Database,
  Sparkles,
  LockKeyhole,
  Check,
  X,
  GitBranch,
} from "lucide-react";
import type { Artifact } from "@/lib/concord/client";
const iconFor = (kind: string) =>
  kind === "source"
    ? BookOpen
    : kind === "chunk"
      ? FileText
      : kind === "index"
        ? Database
        : Sparkles;
export default function DependencyFlow({
  nodes,
  onSelect,
  affected,
}: {
  nodes: Artifact[];
  onSelect: (id: string) => void;
  affected: string[];
}) {
  const sorted = [...nodes].sort(
    (a, b) =>
      ["source", "chunk", "index", "memory"].indexOf(a.kind) -
      ["source", "chunk", "index", "memory"].indexOf(b.kind),
  );
  return (
    <div className="dependency-flow">
      <div className="flow-labels">
        <span>AUTHORITATIVE SOURCE</span>
        <span>REGISTERED DERIVATIVES</span>
      </div>
      <div className="flow-visual">
        <svg
          className="flow-lines"
          viewBox="0 0 800 180"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M105 85 C170 85 140 85 285 85 M300 85 C370 85 360 85 480 85 M500 85 C560 85 570 85 695 85"
            className="flow-track"
          />
          <path
            d="M105 85 C170 85 140 85 285 85 M300 85 C370 85 360 85 480 85 M500 85 C560 85 570 85 695 85"
            className={`flow-signal ${nodes.some((n) => n.status === "blocked") ? "contained" : ""}`}
          />
        </svg>
        {sorted.map((n, i) => {
          const Icon = iconFor(n.kind);
          return (
            <button
              key={n.id}
              className={`flow-node ${n.status === "blocked" ? "is-blocked" : ""} ${n.deleted ? "is-deleted" : ""}`}
              onClick={() => onSelect(n.id)}
            >
              <span className={`node-orbit node-${i}`}>
                <Icon size={24} />
                <span className="node-status">
                  {n.status === "blocked" ? (
                    <LockKeyhole size={10} />
                  ) : n.deleted ? (
                    <X size={10} />
                  ) : (
                    <Check size={10} />
                  )}
                </span>
              </span>
              <strong>
                {n.kind === "source"
                  ? "Source fixture"
                  : n.kind === "chunk"
                    ? "Document chunk"
                    : n.kind === "index"
                      ? "Retrieval index"
                      : "Memory fixture"}
              </strong>
              <small>
                {n.deleted
                  ? "Deleted"
                  : n.status === "blocked"
                    ? "Retrieval contained"
                    : n.kind === "source"
                      ? `Revision ${n.revision}`
                      : "Local state current"}
              </small>
            </button>
          );
        })}
      </div>
      <div className="flow-scope">
        <GitBranch size={14} />
        <span>
          1 source · 3 derivatives ·{" "}
          {nodes.some((n) => n.status === "blocked")
            ? "Containment active"
            : "Explicit lineage"}
        </span>
        <span>LOCAL SANDBOX</span>
      </div>
    </div>
  );
}
