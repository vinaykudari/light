import { jsonWithCors, optionsWithCors } from "@/lib/api/cors";

const baseUrl = "https://light.hackerpod.dev";

export function GET() {
  return jsonWithCors({
    openapi: "3.1.0",
    info: {
      title: "Light Backend API",
      version: "0.3.0",
      summary: "Clinical trial intelligence API for local UI development",
      description: [
        "Light turns a synthetic/de-identified patient profile or doctor/patient transcript into a live clinical-trial intelligence run.",
        "The API streams progress through pollable run state: agent events, official trial cards, research papers, web/X patient voice, expert context links, missing eligibility info, generated artifacts, and Nia-indexed chat.",
        "Safety boundary: Light is for education and clinician-reviewed referral preparation only. It does not diagnose, recommend treatment, determine eligibility, or provide medical advice.",
      ].join("\n\n"),
    },
    servers: [
      { url: baseUrl, description: "Shared backend for hackathon UI development" },
      { url: "http://127.0.0.1:3001", description: "Local backend if running on the VM" },
    ],
    tags: [
      { name: "Health", description: "Capability and service status" },
      { name: "Runs", description: "Create and poll agentic trial intelligence runs" },
      { name: "Chat", description: "Ask questions over the Nia-indexed run corpus" },
      { name: "Spec", description: "Human and machine-readable API documentation" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Check backend and integration capability status",
          responses: {
            "200": {
              description: "Backend is running",
              content: { "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } } },
            },
          },
        },
      },
      "/api/runs": {
        post: {
          tags: ["Runs"],
          summary: "Start a Light trial intelligence run",
          description: [
            "Send either a structured patient profile, a conversation transcript, or both.",
            "For the voice demo, send a transcript and a minimal synthetic patient shell. The conversation agent extracts the private structured profile in memory.",
            "Local UIs should immediately poll GET /api/runs?id={runId} every 700-1500ms until status is completed or failed.",
          ].join("\n\n"),
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateRunRequest" },
                examples: { longCovidConversation: { value: longCovidExample } },
              },
            },
          },
          responses: {
            "202": {
              description: "Run accepted. Poll with returned runId.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/TrialIntelligenceState" } } },
            },
            "200": { description: "Completed synchronously on serverless deployments" },
          },
        },
        get: {
          tags: ["Runs"],
          summary: "Get one run by id, or list recent runs",
          parameters: [{
            name: "id",
            in: "query",
            required: false,
            description: "Run id returned by POST /api/runs",
            schema: { type: "string", example: "run_dfa4ce92-719f-435f-bc83-6f572ad00cb4" },
          }],
          responses: {
            "200": {
              description: "Run state or run list",
              content: { "application/json": { schema: { oneOf: [{ $ref: "#/components/schemas/TrialIntelligenceState" }, { type: "object", properties: { runs: { type: "array", items: { $ref: "#/components/schemas/TrialIntelligenceState" } } } }] } } },
            },
            "404": { description: "Run not found" },
          },
        },
      },
      "/api/chat": {
        post: {
          tags: ["Chat"],
          summary: "Ask a question over completed run sources indexed on Nia",
          description: [
            "Use after a run is completed.",
            "The backend indexes all clinical trial source records from the completed run, research papers, PDFs/pages, X/web sentiment links, and extracted run context into Nia where possible, then answers with LLM synthesis.",
            "Questions that mention an NCT ID are scoped to that specific clinical trial. Questions about papers or sentiment are scoped to paper/web or X/web sources.",
            "Keep chat history short. Send the previous few user/assistant messages in history for continuity.",
          ].join("\n\n"),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatRequest" },
                examples: {
                  indexRun: {
                    value: {
                      runId: "run_dfa4ce92-719f-435f-bc83-6f572ad00cb4",
                      action: "index",
                    },
                  },
                  trialQuestion: {
                    value: {
                      runId: "run_dfa4ce92-719f-435f-bc83-6f572ad00cb4",
                      question: "For NCT06847191, what does the record say is relevant and what should we verify before referral?",
                      history: [],
                    },
                  },
                  missingInfo: {
                    value: {
                      runId: "run_dfa4ce92-719f-435f-bc83-6f572ad00cb4",
                      question: "Which missing details should the doctor collect before referral?",
                      history: [],
                    },
                  },
                },
              },
            },
          },
          parameters: [{
            name: "action",
            in: "query",
            required: false,
            description: "Set action=index to pre-index completed run sources without asking a question.",
            schema: { type: "string", enum: ["index"] },
          }],
          responses: {
            "200": { description: "Chat answer", content: { "application/json": { schema: { $ref: "#/components/schemas/ChatResponse" } } } },
            "400": { description: "Missing runId or question" },
            "404": { description: "Run not found" },
            "409": { description: "Run is not completed yet" },
          },
        },
        get: {
          tags: ["Chat"],
          summary: "Check Nia indexing status for a completed run",
          parameters: [{
            name: "runId",
            in: "query",
            required: true,
            description: "Run id returned by POST /api/runs",
            schema: { type: "string" },
          }],
          responses: {
            "200": { description: "Nia index status", content: { "application/json": { schema: { $ref: "#/components/schemas/ChatIndexResponse" } } } },
          },
        },
      },
      "/api/spec": {
        get: {
          tags: ["Spec"],
          summary: "OpenAPI JSON spec",
          responses: { "200": { description: "This OpenAPI document" } },
        },
      },
      "/api/spec.md": {
        get: {
          tags: ["Spec"],
          summary: "Human-readable markdown API docs",
          responses: { "200": { description: "Markdown API docs" } },
        },
      },
    },
    components: {
      schemas: schemas(),
    },
    "x-light-demo-flow": [
      "POST /api/runs with longCovidConversation example.",
      "Poll GET /api/runs?id={runId}.",
      "Render events as live agent thought stream.",
      "Render trials, research, patientVoice, expertSources, eligibility, burden, artifacts.",
      "When status=completed, POST /api/chat with runId and question.",
    ],
  });
}

export function OPTIONS() {
  return optionsWithCors();
}

const longCovidExample = {
  patient: {
    age: 34,
    diagnosis: "symptom conversation pending",
    biomarkers: [],
    priorTherapies: ["none documented in demo conversation"],
    location: "San Francisco, CA",
    maxTravelMiles: 50,
    preferences: ["wants doctor-reviewed research study options", "prefers low-burden visits"],
    missingDataHints: [],
  },
  conversationTranscript: [
    { speaker: "doctor", text: "Tell me what has been going on." },
    { speaker: "patient", text: "I had COVID about 8 months ago. Since then I have had bad brain fog. I forget words in meetings, I get exhausted after small tasks, and if I go for even a short walk I sometimes crash for a day or two." },
    { speaker: "doctor", text: "When you say crash, do symptoms get worse after activity?" },
    { speaker: "patient", text: "Yeah. It is like delayed exhaustion. Also when I stand up, my heart races and I feel dizzy. Sleep is bad too." },
    { speaker: "doctor", text: "Are you in the Bay Area, and are you interested in research studies if your doctor thinks it is appropriate?" },
    { speaker: "patient", text: "Yes, I am in San Francisco. I just want to know what to ask my doctor." },
  ],
};

function schemas() {
  return {
    HealthResponse: { type: "object", properties: { ok: { type: "boolean" }, app: { type: "string" }, sourceMode: { enum: ["real", "mixed", "mock"] }, capabilities: { $ref: "#/components/schemas/CapabilityReport" } } },
    CapabilityReport: { type: "object", properties: { clinicalTrials: { type: "boolean" }, pubMed: { type: "boolean" }, xPublicSearch: { type: "boolean" }, nia: { type: "boolean" }, tensorlake: { type: "boolean" }, hyperspell: { type: "boolean" }, llm: { type: "boolean" } } },
    CreateRunRequest: { type: "object", properties: { patient: { $ref: "#/components/schemas/PatientProfileInput" }, conversationTranscript: { type: "array", items: { $ref: "#/components/schemas/ConversationTurn" } } } },
    ConversationTurn: { type: "object", required: ["speaker", "text"], properties: { speaker: { enum: ["doctor", "patient"] }, text: { type: "string" } } },
    PatientProfileInput: { type: "object", properties: { id: { type: "string" }, age: { type: "number" }, diagnosis: { type: "string" }, possibleConditionContext: { type: "string" }, symptoms: { type: "array", items: { type: "string" } }, duration: { type: "string" }, onset: { type: "string" }, patientGoal: { type: "string" }, biomarkers: { type: "array", items: { type: "string" } }, priorTherapies: { type: "array", items: { type: "string" } }, location: { type: "string" }, maxTravelMiles: { type: "number" }, preferences: { type: "array", items: { type: "string" } }, missingDataHints: { type: "array", items: { type: "string" } } } },
    TrialIntelligenceState: { type: "object", properties: { runId: { type: "string" }, status: { enum: ["created", "running", "completed", "failed"] }, sourceMode: { enum: ["real", "mixed", "mock"] }, patient: { $ref: "#/components/schemas/PatientProfileInput" }, capabilities: { $ref: "#/components/schemas/CapabilityReport" }, events: { type: "array", items: { $ref: "#/components/schemas/AgentEvent" } }, trials: { type: "array", items: { $ref: "#/components/schemas/TrialCard" } }, research: { $ref: "#/components/schemas/ResearchSummary" }, patientVoice: { type: "array", items: { $ref: "#/components/schemas/PatientVoiceTheme" } }, expertSources: { type: "array", items: { $ref: "#/components/schemas/PatientVoiceSource" } }, eligibility: { type: "array", items: { $ref: "#/components/schemas/EligibilityRow" } }, artifacts: { type: "array", items: { $ref: "#/components/schemas/GeneratedArtifact" } }, createdAt: { type: "string" }, updatedAt: { type: "string" } } },
    AgentEvent: { type: "object", properties: { id: { type: "string" }, runId: { type: "string" }, agent: { enum: ["system", "conversation", "trial", "research", "patient_voice", "eligibility", "burden", "synthesis", "safety"] }, status: { enum: ["queued", "running", "completed", "failed"] }, title: { type: "string" }, detail: { type: "string" }, timestamp: { type: "string" }, metadata: { type: "object" } } },
    TrialCard: { type: "object", properties: { nctId: { type: "string" }, title: { type: "string" }, status: { type: "string" }, phase: { type: "string" }, locations: { type: "array", items: { type: "object" } }, matchedCriteria: { type: "array", items: { type: "string" } }, missingCriteria: { type: "array", items: { type: "string" } }, exclusionRisks: { type: "array", items: { type: "string" } }, coordinatorQuestions: { type: "array", items: { type: "string" } }, sourceUrl: { type: "string" }, source: { type: "string" } } },
    ResearchSummary: { type: "object", properties: { query: { type: "string" }, papersFound: { type: "number" }, selectedPapers: { type: "array", items: { type: "object" } }, themes: { type: "array", items: { type: "string" } }, clinicianQuestions: { type: "array", items: { type: "string" } }, limitations: { type: "array", items: { type: "string" } }, sourceMode: { enum: ["real", "mixed", "mock"] } } },
    PatientVoiceTheme: { type: "object", properties: { theme: { type: "string" }, sentiment: { enum: ["positive", "neutral", "negative", "mixed"] }, signalStrength: { enum: ["low", "medium", "high"] }, summary: { type: "string" }, coordinatorQuestion: { type: "string" }, sourceCount: { type: "number" }, sources: { type: "array", items: { $ref: "#/components/schemas/PatientVoiceSource" } } } },
    PatientVoiceSource: { type: "object", properties: { title: { type: "string" }, url: { type: "string" }, source: { enum: ["x", "web", "seed"] }, snippet: { type: "string" } } },
    EligibilityRow: { type: "object", properties: { trialId: { type: "string" }, trialTitle: { type: "string" }, matchedCriteria: { type: "array", items: { type: "string" } }, missingData: { type: "array", items: { type: "string" } }, possibleExclusionRisks: { type: "array", items: { type: "string" } }, reviewNote: { type: "string" } } },
    GeneratedArtifact: { type: "object", properties: { runId: { type: "string" }, kind: { enum: ["patient_briefing", "clinician_checklist", "coordinator_email", "missing_data_checklist"] }, title: { type: "string" }, content: { type: "string" } } },
    ChatRequest: { type: "object", required: ["runId"], properties: { runId: { type: "string" }, question: { type: "string" }, action: { enum: ["index"] }, history: { type: "array", items: { type: "object", properties: { role: { enum: ["user", "assistant"] }, content: { type: "string" } } } } } },
    ChatIndexResponse: { type: "object", properties: { runId: { type: "string" }, ready: { type: "boolean" }, totalSources: { type: "number" }, indexedSources: { type: "array", items: { type: "object" } }, indexedCount: { type: "number" }, failedCount: { type: "number" } } },
    ChatResponse: { type: "object", properties: { answer: { type: "string" }, indexedSources: { type: "array", items: { type: "object" } }, niaAnswer: { type: "string" }, sourceMode: { enum: ["real", "mixed", "mock"] }, scope: { type: "object" } } },
  };
}
