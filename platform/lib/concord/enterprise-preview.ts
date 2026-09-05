// Deliberately illustrative product data. This module never calls a source API.
export type ApplicationId = "confluence" | "jira";
export type Application = {
  id: ApplicationId;
  name: string;
  kind: string;
  scope: string;
  objects: number;
  unit: string;
  description: string;
};
export const applications: Application[] = [
  {
    id: "confluence",
    name: "Confluence",
    kind: "Knowledge",
    scope: "Product knowledge",
    objects: 248,
    unit: "pages",
    description: "Pages, spaces and the product knowledge your agents use.",
  },
  {
    id: "jira",
    name: "Jira",
    kind: "Work tracking",
    scope: "Platform · Support",
    objects: 124,
    unit: "issues",
    description:
      "Issues, descriptions and work status that inform your agents.",
  },
];
export type Change = {
  id: string;
  app: ApplicationId;
  title: string;
  kind: string;
  state: "updated" | "attention";
  before: string;
  after: string;
  source: string;
  affected: string[];
  steps: { title: string; detail: string; state: "done" | "attention" }[];
};
export const changes: Change[] = [
  {
    id: "change-01",
    app: "confluence",
    title: "API usage limits",
    kind: "Content updated",
    state: "updated",
    before: "100 requests per minute",
    after: "150 requests per minute",
    source: "Product knowledge / API guide · version 13",
    affected: [
      "Support agent · knowledge index",
      "Product assistant · response cache",
    ],
    steps: [
      {
        title: "Source change observed",
        detail: "The connected page exposes a newer version.",
        state: "done",
      },
      {
        title: "Affected data identified",
        detail:
          "Registered page chunks and cached context reference this source ID.",
        state: "done",
      },
      {
        title: "Connected data updated",
        detail:
          "Replace the affected chunks and invalidate the registered cache.",
        state: "done",
      },
      {
        title: "Retrieval checked",
        detail:
          "The example routes return the updated limit for the allowed identity.",
        state: "done",
      },
    ],
  },
  {
    id: "change-02",
    app: "jira",
    title: "PAY-142 · Payment retry policy",
    kind: "Issue updated",
    state: "updated",
    before: "In progress · retry after 30 seconds",
    after: "Done · retry after 60 seconds",
    source: "Platform project / PAY-142",
    affected: ["Product assistant · issue index"],
    steps: [
      {
        title: "Source change observed",
        detail: "The issue description and status have changed.",
        state: "done",
      },
      {
        title: "Affected data identified",
        detail:
          "The registered issue record links this change to the product assistant.",
        state: "done",
      },
      {
        title: "Connected data updated",
        detail: "Refresh the issue context used by that assistant.",
        state: "done",
      },
      {
        title: "Retrieval checked",
        detail: "The example route returns the latest issue state and policy.",
        state: "done",
      },
    ],
  },
  {
    id: "change-03",
    app: "confluence",
    title: "Legacy onboarding guide",
    kind: "Source visibility changed",
    state: "attention",
    before: "Page available in the selected space",
    after: "Page no longer visible to the connector",
    source: "Product knowledge / Legacy onboarding",
    affected: ["Support agent · knowledge index"],
    steps: [
      {
        title: "Visibility change observed",
        detail:
          "The previously known page is absent from the accessible source scope.",
        state: "attention",
      },
      {
        title: "Affected data held",
        detail:
          "The registered copy is blocked while source visibility is unresolved.",
        state: "done",
      },
      {
        title: "Review source access",
        detail:
          "Check whether the page moved, became restricted or was removed. Absence alone does not prove deletion.",
        state: "attention",
      },
    ],
  },
];
