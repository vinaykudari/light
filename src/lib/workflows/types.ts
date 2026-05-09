export type WorkflowEventType =
  | "workflow.started"
  | "workflow.delegated"
  | "workflow.fallback"
  | "workflow.completed"
  | "workflow.failed"
  | "agents.started"
  | "agents.completed"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "synthesis.started"
  | "synthesis.completed"
  | "tensorlake.request.created"
  | "tensorlake.request.completed"
  | (string & {});

export type WorkflowPayload = Record<string, unknown>;

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  type: WorkflowEventType;
  at: string;
  source?: string;
  payload?: WorkflowPayload;
  deliveryErrors?: string[];
}

export type EventSink = (event: WorkflowEvent) => void | Promise<void>;

export interface TrialDocument {
  id?: string;
  title?: string;
  text?: string;
  url?: string;
  metadata?: WorkflowPayload;
}

export interface TrialIntelligenceInput {
  trialId?: string;
  trialTitle?: string;
  condition?: string;
  phase?: string;
  sponsor?: string;
  intervention?: string;
  criteria?: string;
  endpoints?: string;
  patientVoice?: string | string[];
  sites?: string[];
  documents?: TrialDocument[];
  questions?: string[];
  [key: string]: unknown;
}

export interface AgentFinding {
  agentId: string;
  title: string;
  summary: string;
  signals: string[];
  risks: string[];
  actions: string[];
  confidence: number;
}

export interface TrialAgentContext {
  workflowId: string;
  input: TrialIntelligenceInput;
  emit: (
    type: WorkflowEventType,
    payload?: WorkflowPayload,
  ) => Promise<WorkflowEvent>;
  signal?: AbortSignal;
}

export interface TrialAgent {
  id: string;
  label: string;
  run: (context: TrialAgentContext) => AgentFinding | Promise<AgentFinding>;
}

export interface TrialIntelligenceResult {
  workflowId: string;
  status: "completed" | "partial" | "failed";
  summary: string;
  findings: AgentFinding[];
  recommendations: string[];
  risks: string[];
  events: WorkflowEvent[];
  executor: "local" | "tensorlake" | (string & {});
  durationMs: number;
  rawOutput?: unknown;
}

export interface TrialIntelligenceAdapterContext {
  workflowId: string;
  emit: (
    type: WorkflowEventType,
    payload?: WorkflowPayload,
  ) => Promise<WorkflowEvent>;
  signal?: AbortSignal;
}

export interface TrialIntelligenceAdapter {
  name: string;
  available?: () => boolean | Promise<boolean>;
  runTrialIntelligence: (
    input: TrialIntelligenceInput,
    context: TrialIntelligenceAdapterContext,
  ) => Promise<TrialIntelligenceResult>;
}

export interface RunTrialIntelligenceOptions {
  workflowId?: string;
  agents?: TrialAgent[];
  emit?: EventSink | EventSink[];
  adapter?: TrialIntelligenceAdapter;
  tensorlake?: {
    apiKey?: string;
    appName?: string;
    baseUrl?: string;
    pollIntervalMs?: number;
    timeoutMs?: number;
    fetcher?: typeof fetch;
  };
  useTensorlake?: boolean;
  fallbackToLocal?: boolean;
  collectEvents?: boolean;
  signal?: AbortSignal;
  now?: () => Date;
}
