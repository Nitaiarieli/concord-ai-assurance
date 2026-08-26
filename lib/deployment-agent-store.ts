import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  analyticsEvents,
  auditEvents,
  connectedApplications,
  deploymentAgentEvents,
  deploymentAgentEvidence,
  deploymentAgentFindings,
  deploymentAgentRuns,
  generatedReports,
} from "@/db/schema";
import { getOrCreateOrganization, requireOrganizationMembership } from "@/lib/workspace";
import {
  CENTRAL_HYPOTHESIS,
  RESEARCH_AS_OF,
  auditDeploymentRecommendation,
  buildDecisionDossier,
  buildDeploymentRecommendation,
  dossierToMarkdown,
  normalizeDeploymentAgentIntake,
  reviseRejectedRecommendation,
  runDeploymentResearch,
  runProductAnalysis,
  type DeploymentAgentIntake,
} from "@/lib/deployment-agent";

function now() {
  return new Date().toISOString();
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function validRequestKey(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{8,120}$/.test(value)) throw new Error("A valid idempotency key is required.");
  return value;
}

async function runForOrganization(organizationId: string, runId: string) {
  const [run] = await (await getDb())
    .select()
    .from(deploymentAgentRuns)
    .where(and(eq(deploymentAgentRuns.organizationId, organizationId), eq(deploymentAgentRuns.id, runId)))
    .limit(1);
  if (!run) throw new Error("Deployment-agent run not found.");
  return run;
}

async function eventOutput<T>(organizationId: string, runId: string, skill: string, cycle = 0) {
  const [event] = await (await getDb())
    .select({ outputJson: deploymentAgentEvents.outputJson })
    .from(deploymentAgentEvents)
    .where(and(
      eq(deploymentAgentEvents.organizationId, organizationId),
      eq(deploymentAgentEvents.runId, runId),
      eq(deploymentAgentEvents.skill, skill),
      eq(deploymentAgentEvents.cycle, cycle),
    ))
    .limit(1);
  if (!event) throw new Error(`Required ${skill} output is unavailable.`);
  return JSON.parse(event.outputJson) as T;
}

async function nextSequence(organizationId: string, runId: string) {
  const events = await (await getDb()).select({ id: deploymentAgentEvents.id }).from(deploymentAgentEvents).where(and(
    eq(deploymentAgentEvents.organizationId, organizationId),
    eq(deploymentAgentEvents.runId, runId),
  ));
  return events.length + 1;
}

async function writeSkillEvent(input: {
  organizationId: string;
  runId: string;
  skill: string;
  cycle?: number;
  sequence: number;
  input: unknown;
  output: unknown;
  sourceCount?: number;
}) {
  const timestamp = now();
  await (await getDb()).insert(deploymentAgentEvents).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    runId: input.runId,
    skill: input.skill,
    cycle: input.cycle ?? 0,
    sequence: input.sequence,
    status: "completed",
    inputJson: JSON.stringify(input.input),
    outputJson: JSON.stringify(input.output),
    sourceCount: input.sourceCount ?? 0,
    startedAt: timestamp,
    completedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

async function detailForRun(organizationId: string, runId: string) {
  const db = await getDb();
  const run = await runForOrganization(organizationId, runId);
  const [events, evidence, findings] = await Promise.all([
    db.select().from(deploymentAgentEvents).where(and(eq(deploymentAgentEvents.organizationId, organizationId), eq(deploymentAgentEvents.runId, runId))).orderBy(asc(deploymentAgentEvents.sequence)),
    db.select().from(deploymentAgentEvidence).where(and(eq(deploymentAgentEvidence.organizationId, organizationId), eq(deploymentAgentEvidence.runId, runId))).orderBy(asc(deploymentAgentEvidence.createdAt)),
    db.select().from(deploymentAgentFindings).where(and(eq(deploymentAgentFindings.organizationId, organizationId), eq(deploymentAgentFindings.runId, runId))).orderBy(asc(deploymentAgentFindings.createdAt)),
  ]);
  return {
    ...run,
    intake: parseJson(run.intakeJson, {}),
    recommendation: parseJson(run.recommendationJson, null),
    audit: parseJson(run.auditJson, null),
    dossier: parseJson(run.dossierJson, null),
    events: events.map((event) => ({ ...event, input: parseJson(event.inputJson, {}), output: parseJson(event.outputJson, {}) })),
    evidence,
    findings,
  };
}

export async function getDeploymentAgentSnapshot(email: string, displayName: string) {
  const organizationId = await getOrCreateOrganization(email, displayName);
  const db = await getDb();
  const [runs, applications] = await Promise.all([
    db.select({ id: deploymentAgentRuns.id, status: deploymentAgentRuns.status, currentStage: deploymentAgentRuns.currentStage, researchAsOf: deploymentAgentRuns.researchAsOf, createdAt: deploymentAgentRuns.createdAt, completedAt: deploymentAgentRuns.completedAt })
      .from(deploymentAgentRuns)
      .where(eq(deploymentAgentRuns.organizationId, organizationId))
      .orderBy(desc(deploymentAgentRuns.createdAt))
      .limit(8),
    db.select({ provider: connectedApplications.provider, displayName: connectedApplications.displayName })
      .from(connectedApplications)
      .where(eq(connectedApplications.organizationId, organizationId)),
  ]);
  return {
    organizationId,
    connectedApplicationContext: applications,
    runs,
    latestRun: runs[0] ? await detailForRun(organizationId, runs[0].id) : null,
  };
}

export async function createDeploymentAgentRun(
  email: string,
  displayName: string,
  inputValue: unknown,
  requestKeyValue: unknown,
) {
  const organizationId = await getOrCreateOrganization(email, displayName);
  const requestKey = validRequestKey(requestKeyValue);
  const db = await getDb();
  const [existing] = await db.select({ id: deploymentAgentRuns.id }).from(deploymentAgentRuns).where(and(
    eq(deploymentAgentRuns.organizationId, organizationId),
    eq(deploymentAgentRuns.requestKey, requestKey),
  )).limit(1);
  if (existing) return detailForRun(organizationId, existing.id);

  const applications = await db.select({ provider: connectedApplications.provider }).from(connectedApplications).where(eq(connectedApplications.organizationId, organizationId));
  const input = normalizeDeploymentAgentIntake(inputValue);
  input.priorityIntegrations = [...new Set([...input.priorityIntegrations, ...applications.map((application) => application.provider)])];
  const timestamp = now();
  const runId = crypto.randomUUID();
  await db.insert(deploymentAgentRuns).values({
    id: runId,
    organizationId,
    requestKey,
    createdBy: email.toLowerCase(),
    status: "running",
    currentStage: "research",
    hypothesis: CENTRAL_HYPOTHESIS,
    intakeJson: JSON.stringify(input),
    revisionCount: 0,
    researchAsOf: RESEARCH_AS_OF,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId,
    actorEmail: email.toLowerCase(),
    action: "deployment_agent.run_started",
    entityType: "deployment_agent_run",
    entityId: runId,
    afterJson: JSON.stringify({ currentStage: "research", researchAsOf: RESEARCH_AS_OF }),
    occurredAt: timestamp,
  });
  return detailForRun(organizationId, runId);
}

export async function advanceDeploymentAgentRun(email: string, runId: string) {
  const membership = await requireOrganizationMembership(email);
  const run = await runForOrganization(membership.organizationId, runId);
  if (run.status === "completed") return detailForRun(membership.organizationId, runId);
  const intake = parseJson<DeploymentAgentIntake>(run.intakeJson, normalizeDeploymentAgentIntake({}));
  const db = await getDb();
  const timestamp = now();

  if (run.currentStage === "research") {
    const research = runDeploymentResearch(intake);
    const product = runProductAnalysis(intake);
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "deployment_research", sequence: 1, input: { intake, independenceRule: "No recommendation is permitted in this skill." }, output: research, sourceCount: research.evidence.length });
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "product_analysis", sequence: 2, input: { intake, productBoundary: "Registered artifacts and supported adapters only." }, output: product });
    for (const item of research.evidence) {
      await db.insert(deploymentAgentEvidence).values({
        id: crypto.randomUUID(), organizationId: membership.organizationId, runId, skill: "deployment_research", claim: item.claim,
        classification: item.classification, sourceTitle: item.sourceTitle, sourceUrl: item.sourceUrl, sourceType: item.sourceType,
        publishedAt: item.publishedAt, accessedAt: item.accessedAt, confidence: item.confidence, createdAt: timestamp, updatedAt: timestamp,
      });
    }
    await db.update(deploymentAgentRuns).set({ currentStage: "recommendation", updatedAt: timestamp }).where(eq(deploymentAgentRuns.id, runId));
  } else if (run.currentStage === "recommendation") {
    const recommendation = buildDeploymentRecommendation(intake);
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "deployment_recommendation", sequence: await nextSequence(membership.organizationId, runId), input: { researchSkill: "completed", productSkill: "completed", hypothesis: run.hypothesis }, output: recommendation, sourceCount: 7 });
    await db.update(deploymentAgentRuns).set({ currentStage: "audit", recommendationJson: JSON.stringify(recommendation), updatedAt: timestamp }).where(eq(deploymentAgentRuns.id, runId));
  } else if (run.currentStage === "audit") {
    const recommendation = parseJson<ReturnType<typeof buildDeploymentRecommendation>>(run.recommendationJson, buildDeploymentRecommendation(intake));
    const audit = auditDeploymentRecommendation(intake, recommendation);
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "security_compliance_audit", sequence: await nextSequence(membership.organizationId, runId), input: { recommendation, independentGate: true }, output: audit, sourceCount: 2 });
    for (const finding of audit.findings) {
      await db.insert(deploymentAgentFindings).values({
        id: crypto.randomUUID(), organizationId: membership.organizationId, runId, cycle: 0, severity: finding.severity,
        component: finding.component, risk: finding.risk, remediation: finding.remediation, owner: finding.owner,
        validationMethod: finding.validationMethod, status: finding.status, createdAt: timestamp, updatedAt: timestamp,
      });
    }
    await db.update(deploymentAgentRuns).set({ currentStage: audit.blockingFindings ? "revision" : "finalization", auditJson: JSON.stringify(audit), updatedAt: timestamp }).where(eq(deploymentAgentRuns.id, runId));
  } else if (run.currentStage === "revision") {
    const prior = parseJson<ReturnType<typeof buildDeploymentRecommendation>>(run.recommendationJson, buildDeploymentRecommendation(intake));
    const recommendation = reviseRejectedRecommendation(intake, prior);
    const audit = { ...auditDeploymentRecommendation(intake, recommendation), cycle: 1 };
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "deployment_recommendation", cycle: 1, sequence: await nextSequence(membership.organizationId, runId), input: { priorRecommendation: prior, rejection: parseJson(run.auditJson, {}) }, output: recommendation });
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "security_compliance_audit", cycle: 1, sequence: await nextSequence(membership.organizationId, runId), input: { recommendation, independentGate: true }, output: audit });
    await db.update(deploymentAgentRuns).set({ currentStage: "finalization", recommendationJson: JSON.stringify(recommendation), auditJson: JSON.stringify(audit), revisionCount: 1, updatedAt: timestamp }).where(eq(deploymentAgentRuns.id, runId));
  } else if (run.currentStage === "finalization") {
    const research = await eventOutput<ReturnType<typeof runDeploymentResearch>>(membership.organizationId, runId, "deployment_research");
    const product = await eventOutput<ReturnType<typeof runProductAnalysis>>(membership.organizationId, runId, "product_analysis");
    const recommendation = parseJson<ReturnType<typeof buildDeploymentRecommendation>>(run.recommendationJson, buildDeploymentRecommendation(intake));
    const audit = parseJson<ReturnType<typeof auditDeploymentRecommendation>>(run.auditJson, auditDeploymentRecommendation(intake, recommendation));
    const dossier = buildDecisionDossier(intake, research, product, recommendation, audit);
    await writeSkillEvent({ organizationId: membership.organizationId, runId, skill: "orchestrator_finalization", sequence: await nextSequence(membership.organizationId, runId), input: { completedSkills: 4, auditOutcome: audit.outcome }, output: { dossierTitle: dossier.title, sections: dossier.sections.length } });
    await db.insert(generatedReports).values({
      id: crypto.randomUUID(), organizationId: membership.organizationId, reportType: "deployment_integration_decision_dossier",
      status: "complete", outputFormat: "markdown", generatedBy: email.toLowerCase(), createdAt: timestamp, updatedAt: timestamp,
    });
    await db.insert(analyticsEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organizationId, actorEmail: email.toLowerCase(), eventName: "deployment_agent_run_completed",
      route: "/deployment-agent", propertiesJson: JSON.stringify({ recommendation: recommendation.primary.id, auditOutcome: audit.outcome, revisionCount: run.revisionCount }), occurredAt: timestamp,
    });
    await db.insert(auditEvents).values({
      id: crypto.randomUUID(), organizationId: membership.organizationId, actorEmail: email.toLowerCase(), action: "deployment_agent.run_completed",
      entityType: "deployment_agent_run", entityId: runId, beforeJson: JSON.stringify({ status: run.status, currentStage: run.currentStage }),
      afterJson: JSON.stringify({ status: "completed", currentStage: "complete", recommendation: recommendation.primary.id, auditOutcome: audit.outcome }), occurredAt: timestamp,
    });
    await db.update(deploymentAgentRuns).set({ status: "completed", currentStage: "complete", dossierJson: JSON.stringify(dossier), completedAt: timestamp, updatedAt: timestamp }).where(eq(deploymentAgentRuns.id, runId));
  } else {
    throw new Error("The deployment-agent run is in an unsupported state.");
  }
  return detailForRun(membership.organizationId, runId);
}

export async function deploymentAgentDossierMarkdown(email: string, runId: string) {
  const membership = await requireOrganizationMembership(email);
  const run = await runForOrganization(membership.organizationId, runId);
  const dossier = parseJson<ReturnType<typeof buildDecisionDossier> | null>(run.dossierJson, null);
  if (!dossier) throw new Error("The decision dossier is not complete.");
  return dossierToMarkdown(dossier);
}
