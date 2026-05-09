import { corsHeaders } from "@/lib/api/cors";

const docs = `# Light Backend API

Base URL: https://light.hackerpod.dev

Safety: Light is for education and clinician-reviewed trial discussion prep only. It does not diagnose, recommend treatment, determine eligibility, or provide medical advice. Use synthetic/de-identified data only.

## CORS

All API routes return permissive CORS headers for local UI development:

- Access-Control-Allow-Origin: *
- Methods: GET, POST, OPTIONS
- Headers: Content-Type, Authorization

## Flow For Local UI Teams

1. POST /api/runs with a synthetic patient profile or doctor/patient transcript.
2. Read the returned runId.
3. Poll GET /api/runs?id={runId} every 700-1500ms.
4. Render events as the live agent stream.
5. When status is completed, render trials, research, patientVoice, eligibility, artifacts.
6. POST /api/chat with runId and a question to ask over the Nia-indexed run corpus.

## Endpoints

### GET /api/health

Returns enabled capabilities for ClinicalTrials.gov, PubMed, X public search, Nia, Tensorlake, Hyperspell, and LLM.

### POST /api/runs

Starts an agentic trial intelligence run.

\`\`\`json
{
  "patient": {
    "age": 34,
    "diagnosis": "symptom conversation pending",
    "biomarkers": [],
    "priorTherapies": ["none documented in demo conversation"],
    "location": "San Francisco, CA",
    "maxTravelMiles": 50,
    "preferences": ["wants doctor-reviewed research study options"],
    "missingDataHints": []
  },
  "conversationTranscript": [
    { "speaker": "doctor", "text": "Tell me what has been going on." },
    { "speaker": "patient", "text": "I had COVID about 8 months ago. Since then I have had bad brain fog..." }
  ]
}
\`\`\`

Response is a TrialIntelligenceState. On the shared VM it normally returns status created or running with a runId.

### GET /api/runs?id={runId}

Returns the latest run state.

Important fields:

- status: created, running, completed, failed
- events: live agent thought/process stream
- trials: official trial cards
- research.selectedPapers: PubMed/Nia papers and links
- patientVoice: aggregate X/web sentiment themes plus source links
- eligibility: missing and review-needed criteria
- artifacts: patient briefing, clinician checklist, coordinator email, missing data checklist

### POST /api/chat

Ask questions after a run completes. The backend indexes all clinical trial source records returned for that run, papers, PDFs/pages, X/web links, and run context into Nia where possible.

To pre-index without asking a question:

\`\`\`json
{ "runId": "run_example", "action": "index" }
\`\`\`

To ask about a specific clinical trial, mention the NCT ID. The chat agent scopes retrieval to that clinical trial source when possible.

\`\`\`json
{
  "runId": "run_example",
  "question": "For NCT06847191, what should we verify before referral?",
  "history": []
}
\`\`\`

Response:

\`\`\`json
{
  "answer": "Clinician-reviewed answer...",
  "indexedSources": [],
  "niaAnswer": "Raw Nia corpus answer...",
  "sourceMode": "real",
  "scope": { "kind": "trial", "trialId": "NCT06847191" }
}
\`\`\`

### GET /api/chat?runId={runId}

Returns current Nia indexing status for that completed run.

## OpenAPI

Machine-readable spec: https://light.hackerpod.dev/api/spec
`;

export function GET() {
  return new Response(docs, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
