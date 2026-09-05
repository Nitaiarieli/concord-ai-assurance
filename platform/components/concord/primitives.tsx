import { Check } from "lucide-react";
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="M25 7a13 13 0 1 0 0 26" stroke="currentColor" strokeWidth="4" />
      <path d="M31 12a9 9 0 1 0 0 16" stroke="currentColor" strokeWidth="4" />
      <circle cx="30" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}
export function Status({ value }: { value: string }) {
  const success = ["verified", "current", "ready", "passed"].includes(value);
  return (
    <span
      className={`status ${success ? "success" : ["blocked", "contained", "unverified", "failed"].includes(value) ? "warning" : "neutral"}`}
    >
      {success ? <Check size={13} /> : <span className="status-dot" />}
      {value === "current"
        ? "Current"
        : value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}
