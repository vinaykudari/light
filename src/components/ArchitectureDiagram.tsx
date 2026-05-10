"use client";

import type { AgentEvent, CapabilityReport, TrialIntelligenceState } from "@/lib/types";
import styles from "./LightDashboard.module.css";

type ArchNode = {
  title: string;
  detail: string;
  metric?: string;
  active?: boolean;
};

type SponsorNode = {
  name: string;
  domain: string;
  role: string;
  capability?: keyof CapabilityReport;
  match: RegExp;
};

const sponsors: SponsorNode[] = [
  { name: "Tensorlake", domain: "tensorlake.ai", role: "stateful background workflow and sandbox execution", capability: "tensorlake", match: /tensorlake|workflow executor/i },
  { name: "Nia", domain: "trynia.ai", role: "cross-source indexing, web/PDF retrieval, and chat corpus", capability: "nia", match: /nia|web context|indexed/i },
  { name: "Hyperspell", domain: "hyperspell.com", role: "clinic memory recall and prior clarification context", capability: "hyperspell", match: /hyperspell|clinic memory/i },
  { name: "Convex", domain: "convex.dev", role: "live run model, event stream, and dashboard state", match: /realtime|state|dashboard|event/i },
  { name: "X.com", domain: "x.com", role: "public patient voice and expert-context signals", capability: "xPublicSearch", match: /x api|x\.com|public post|patient-experience|expert/i },
  { name: "OpenAI", domain: "openai.com", role: "conversation extraction, ranking, synthesis, and safety language", capability: "llm", match: /llm|synthes|extract|rank|safety/i },
  { name: "ClinicalTrials.gov", domain: "clinicaltrials.gov", role: "official protocol records and NCT clinical trial metadata", capability: "clinicalTrials", match: /clinicaltrials|trial records|nct/i },
  { name: "PubMed", domain: "ncbi.nlm.nih.gov", role: "published biomedical paper retrieval", capability: "pubMed", match: /pubmed|papers|research/i },
];

export function ArchitectureDiagram({ run }: { run: TrialIntelligenceState | null }) {
  const events = run?.events ?? [];
  const caps = run?.capabilities;
  const trialCount = run?.trials?.length ?? 0;
  const paperCount = run?.research?.selectedPapers?.length ?? 0;
  const patientSources = (run?.patientVoice ?? []).flatMap((theme) => theme.sources ?? []).length;
  const expertCount = run?.expertSources?.length ?? 0;
  const artifactCount = run?.artifacts?.length ?? 0;

  const columns = [
    {
      title: "Intake",
      nodes: [
        node("Doctor conversation", "Symptoms, duration, goals, location, and missing follow-up questions.", run?.conversation ? `${run.conversation.transcript.length} turns` : "ready", hasAgent(events, "conversation")),
        node("Synthetic profile", "De-identified patient context only. No PHI is required for the demo flow.", run?.patient?.location ?? "not started", Boolean(run)),
      ],
    },
    {
      title: "Agent layer",
      nodes: [
        node("Workflow router", "Tensorlake when configured; local async executor keeps the same interface.", caps?.tensorlake ? "Tensorlake active" : "local path", hasEvent(events, /workflow executor|tensorlake/i)),
        node("Parallel agents", "Clinical trial, research, patient voice, eligibility, burden, synthesis, and safety agents run as separate responsibilities.", `${events.length} events`, events.length > 0),
      ],
    },
    {
      title: "Sources",
      nodes: [
        node("Official clinical trials", "ClinicalTrials.gov records are normalized into clinical trial cards and coordinator questions.", `${trialCount} clinical trials`, Boolean(trialCount)),
        node("Research papers", "PubMed and Nia return papers, PDFs, and protocol-adjacent pages for clinician review.", `${paperCount} papers`, Boolean(paperCount)),
        node("Public signals", "X.com and web sources are aggregated into patient voice and expert-context themes.", `${patientSources + expertCount} sources`, patientSources + expertCount > 0),
      ],
    },
    {
      title: "Recall",
      nodes: [
        node("Nia corpus", "Clinical trial records, papers, public signals, and expert sources are indexed for clinical trial chat.", caps?.nia ? "indexing ready" : "not configured", caps?.nia),
        node("Clinical chat", "Questions can scope to a selected NCT ID while still referencing the full run corpus.", run?.status === "completed" ? "available" : "after run", run?.status === "completed"),
      ],
    },
    {
      title: "Output",
      nodes: [
        node("Safety pass", "Removes medical-advice language, eligibility claims, recommendations, and social identifiers.", hasAgent(events, "safety") ? "reviewed" : "pending", hasAgent(events, "safety")),
        node("Artifacts", "Patient briefing, clinician checklist, coordinator draft, and missing-data checklist.", `${artifactCount} generated`, Boolean(artifactCount)),
      ],
    },
  ];

  return (
    <section className={styles.archPanel}>
      <div className={styles.archHeader}>
        <div>
          <p className={styles.microLabel}>Under the hood</p>
          <h2>Architecture</h2>
          <p>Light turns a live doctor-patient conversation into a source-backed clinical trial intelligence run, then indexes the run for clinical trial-specific chat.</p>
        </div>
        <div className={styles.archRunBadge}>
          <span>{run?.sourceMode ?? "ready"} mode</span>
          <strong>{run?.runId ?? "no active run"}</strong>
        </div>
      </div>

      <div className={styles.archFlow}>
        {columns.map((column, columnIndex) => (
          <div className={styles.archColumn} key={column.title}>
            <div className={styles.archColumnTitle}>{column.title}</div>
            {column.nodes.map((item) => (
              <article className={styles.archNode} data-active={item.active || undefined} key={item.title}>
                <div className={styles.archNodeTop}>
                  <strong>{item.title}</strong>
                  {item.metric ? <span>{item.metric}</span> : null}
                </div>
                <p>{item.detail}</p>
              </article>
            ))}
            {columnIndex < columns.length - 1 ? <div className={styles.archArrow}>→</div> : null}
          </div>
        ))}
      </div>

      <div className={styles.sponsorMap}>
        <div>
          <p className={styles.microLabel}>Sponsor/service map</p>
          <h3>What each service is doing in this run</h3>
        </div>
        <div className={styles.sponsorMapGrid}>
          {sponsors.map((sponsor) => {
            const configured = sponsor.capability ? caps?.[sponsor.capability] ?? false : true;
            const active = events.some((event) => sponsor.match.test(`${event.agent} ${event.title} ${event.detail}`));
            return (
              <article className={styles.sponsorMapCard} data-active={active || undefined} key={sponsor.name}>
                <img alt="" src={`https://www.google.com/s2/favicons?sz=64&domain=${sponsor.domain}`} />
                <div>
                  <div className={styles.sponsorMapTop}>
                    <strong>{sponsor.name}</strong>
                    <span>{active ? "used" : configured ? "configured" : "off"}</span>
                  </div>
                  <p>{sponsor.role}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function node(title: string, detail: string, metric?: string, active?: boolean): ArchNode {
  return { title, detail, metric, active };
}

function hasAgent(events: AgentEvent[], agent: AgentEvent["agent"]): boolean {
  return events.some((event) => event.agent === agent);
}

function hasEvent(events: AgentEvent[], match: RegExp): boolean {
  return events.some((event) => match.test(`${event.agent} ${event.title} ${event.detail}`));
}
