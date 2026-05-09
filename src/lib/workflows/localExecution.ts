import { defaultTrialAgents } from "./agents";
import { synthesizeTrialIntelligence } from "./synthesis";
import type {
  AgentFinding,
  RunTrialIntelligenceOptions,
  TrialAgent,
  TrialIntelligenceInput,
  TrialIntelligenceResult,
  WorkflowEvent,
  WorkflowEventType,
  WorkflowPayload,
} from "./types";

interface LocalWorkflowArgs {
  input: TrialIntelligenceInput;
  options: RunTrialIntelligenceOptions;
  workflowId: string;
  startedAt: number;
  events: WorkflowEvent[];
  emit: (
    type: WorkflowEventType,
    payload?: WorkflowPayload,
  ) => Promise<WorkflowEvent>;
}

export async function runLocalWorkflow(
  args: LocalWorkflowArgs,
): Promise<TrialIntelligenceResult> {
  const agents = args.options.agents ?? defaultTrialAgents;
  await args.emit("agents.started", {
    executor: "local",
    agentIds: agents.map((agent) => agent.id),
  });

  const settled = await Promise.allSettled(
    agents.map((agent) => runAgent(agent, args)),
  );
  const findings = settled
    .filter(isFulfilledFinding)
    .map((result) => result.value);
  const failures = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => errorMessage(result.reason));

  await args.emit("agents.completed", {
    succeeded: findings.length,
    failed: failures.length,
    failures,
  });

  if (findings.length === 0) {
    await args.emit("workflow.failed", { error: "All trial agents failed." });
    throw new Error("All trial agents failed.");
  }

  await args.emit("synthesis.started", { findingCount: findings.length });
  const result = synthesizeTrialIntelligence({
    workflowId: args.workflowId,
    input: args.input,
    findings,
    events: args.events,
    executor: "local",
    durationMs: Date.now() - args.startedAt,
  });
  await args.emit("synthesis.completed", {
    risks: result.risks.length,
    recommendations: result.recommendations.length,
  });
  await args.emit("workflow.completed", {
    executor: "local",
    status: result.status,
  });

  return { ...result, events: args.events, durationMs: Date.now() - args.startedAt };
}

async function runAgent(
  agent: TrialAgent,
  args: LocalWorkflowArgs,
): Promise<AgentFinding> {
  await args.emit("agent.started", {
    agentId: agent.id,
    label: agent.label,
  });

  let finding: AgentFinding;
  try {
    finding = await agent.run({
      workflowId: args.workflowId,
      input: args.input,
      emit: args.emit,
      signal: args.options.signal,
    });
  } catch (error) {
    await args.emit("agent.failed", {
      agentId: agent.id,
      label: agent.label,
      error: errorMessage(error),
    });
    throw error;
  }

  await args.emit("agent.completed", {
    agentId: agent.id,
    confidence: finding.confidence,
    signals: finding.signals.length,
    risks: finding.risks.length,
  });

  return finding;
}

function isFulfilledFinding(
  result: PromiseSettledResult<AgentFinding>,
): result is PromiseFulfilledResult<AgentFinding> {
  return result.status === "fulfilled";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
