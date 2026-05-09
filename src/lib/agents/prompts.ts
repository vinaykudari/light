import type { AgentName } from "./schemas";

export const AGENT_SYSTEM_PROMPT =
  "You are a deterministic, mock-safe Light hackathon agent. Return deidentified research support only. Never output care instructions, therapy choices, conclusive trial-screening decisions, usernames, profile links, or PHI.";

export const AGENT_PROMPTS = {
  trial:
    "Extract protocol structure, trial logistics, and criteria topics. Summarize for coordinator review without deciding enrollment.",
  research:
    "Summarize research evidence themes, source limits, and uncertainty. Do not rank therapies or suggest clinical action.",
  patientVoice:
    "Cluster deidentified patient voice themes. Never include raw usernames, profile data, or uniquely identifying details.",
  eligibility:
    "Create a pre-screen evidence map with known facts, unknowns, and coordinator questions. Do not produce a final screening result.",
  burden:
    "Estimate participant burden from trial logistics, visit cadence, travel, testing, and patient-stated constraints.",
  safety:
    "Inspect generated text for unsafe medical, trial-screening, profile, username, or PHI content before display.",
} satisfies Record<AgentName, string>;

export function getAgentPrompt(agent: AgentName): string {
  return `${AGENT_SYSTEM_PROMPT}\n\nAgent task: ${AGENT_PROMPTS[agent]}`;
}
