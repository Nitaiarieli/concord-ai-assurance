import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  auditDeploymentRecommendation,
  buildDecisionDossier,
  buildDeploymentRecommendation,
  deploymentWeights,
  normalizeDeploymentAgentIntake,
  runDeploymentResearch,
  runProductAnalysis,
  scoreDeploymentOptions,
} from "../lib/deployment-agent.ts";

const defaultIntake = normalizeDeploymentAgentIntake({});

test("deployment-agent weights implement the required deterministic model", () => {
  assert.equal(Number(Object.values(deploymentWeights).reduce((sum, weight) => sum + weight, 0).toFixed(6)), 1);
  assert.deepEqual(deploymentWeights, {
    security: 0.25,
    promise: 0.2,
    integration: 0.15,
    enterprise: 0.15,
    operations: 0.1,
    performance: 0.05,
    tco: 0.05,
    timeToValue: 0.05,
  });
});

test("default Concord constraints select a stable hybrid control/data-plane architecture", () => {
  const recommendation = buildDeploymentRecommendation(defaultIntake);
  assert.equal(recommendation.primary.id, "hybrid_control_data_plane");
  assert.equal(recommendation.sensitivity.stable, true);
  assert.equal(recommendation.alternative.id, "customer_hosted");
  assert.match(recommendation.customerOnlyData.join(" "), /Organizational content/i);
  assert.match(recommendation.customerOnlyData.join(" "), /Credentials/i);
});

test("mandatory air-gap requirement eliminates connected deployment models before ranking", () => {
  const intake = normalizeDeploymentAgentIntake({ airGapped: true });
  const options = scoreDeploymentOptions(intake);
  assert.equal(options.find((option) => option.eligible)?.id, "air_gapped");
  assert.equal(options.filter((option) => option.eligible).length, 1);
});

test("independent audit rejects a recommendation that violates prohibited data egress", () => {
  const safe = buildDeploymentRecommendation(defaultIntake);
  const unsafe = {
    ...safe,
    primary: safe.options.find((option) => option.id === "multi_tenant_saas"),
  };
  const audit = auditDeploymentRecommendation(defaultIntake, unsafe);
  assert.equal(audit.outcome, "Rejected — Revision Required");
  assert.equal(audit.blockingFindings, 1);
  assert.equal(audit.independentGate, true);
});

test("dossier contains all 26 required sections and does not claim certification", () => {
  const research = runDeploymentResearch(defaultIntake);
  const product = runProductAnalysis(defaultIntake);
  const recommendation = buildDeploymentRecommendation(defaultIntake);
  const audit = auditDeploymentRecommendation(defaultIntake, recommendation);
  const dossier = buildDecisionDossier(defaultIntake, research, product, recommendation, audit);
  assert.equal(dossier.sections.length, 26);
  assert.equal(dossier.sections[0].title, "Executive Decision");
  assert.equal(dossier.sections.at(-1).title, "Evidence and Sources Appendix");
  assert.match(audit.complianceStatement, /not a claim/i);
});

test("deployment-agent persistence is tenant-scoped and run creation is idempotent", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  for (const table of ["deploymentAgentRuns", "deploymentAgentEvents", "deploymentAgentEvidence", "deploymentAgentFindings"]) {
    const start = schema.indexOf(`export const ${table}`);
    assert.notEqual(start, -1, `${table} must exist`);
    const next = schema.indexOf("export const ", start + 14);
    assert.match(schema.slice(start, next === -1 ? undefined : next), /organizationId:/);
  }
  assert.match(schema, /deployment_agent_runs_org_request_uidx/);
  assert.match(schema, /deployment_agent_events_run_skill_cycle_uidx/);
});
