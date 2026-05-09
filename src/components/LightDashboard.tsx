"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrialIntelligenceState } from "@/lib/types";
import { AgentEventStream } from "./AgentEventStream";
import { ArtifactPanel } from "./ArtifactPanel";
import { DoctorConversationDemo, type ConversationPayload } from "./DoctorConversationDemo";
import { EligibilityPanel } from "./EligibilityPanel";
import { PatientVoicePanel } from "./PatientVoicePanel";
import { ResearchChat } from "./ResearchChat";
import { ResearchPanel } from "./ResearchPanel";
import { SafetyBanner } from "./SafetyBanner";
import { SponsorRail } from "./SponsorRail";
import { TrialExplorer } from "./TrialExplorer";
import { Empty, List, Panel } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function LightDashboard() {
  const [run, setRun] = useState<TrialIntelligenceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isProcessing = run?.status === "created" || run?.status === "running";

  useEffect(() => {
    if (!run || !isProcessing) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/runs?id=${encodeURIComponent(run.runId)}`);
      if (!response.ok) return;
      const next = (await response.json()) as TrialIntelligenceState;
      setRun(next);
      if (next.status === "completed" || next.status === "failed") {
        window.clearInterval(timer);
      }
    }, 700);
    return () => window.clearInterval(timer);
  }, [run, isProcessing]);

  const sourceMode = useMemo(() => {
    if (!run) return "demo ready";
    return `${run.sourceMode} mode`;
  }, [run]);

  async function processConversation(payload: ConversationPayload) {
    setError(null);
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError("Conversation run could not be started.");
      return;
    }
    setRun((await response.json()) as TrialIntelligenceState);
  }

  const questions = [
    ...(run?.burden?.coordinatorQuestions ?? []),
    ...((run?.patientVoice ?? []).map((theme) => theme.coordinatorQuestion)),
  ];

  return (
    <main className="shell">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Light / clinical intelligence OS</p>
          <h1>Agentic trial matching from live conversation, evidence, and patient voice.</h1>
          <p className="muted">
            Doctor voice captures symptoms, agents retrieve real trial records, papers, web sentiment, and sponsor-backed context, then assemble referral prep for clinician review.
          </p>
        </div>
        <div className={styles.sourceMode} aria-live="polite">
          <span className={isProcessing ? styles.pulse : styles.dot} />
          Source mode: {sourceMode}
        </div>
      </header>

      <SafetyBanner />
      <SponsorRail events={run?.events ?? []} capabilities={run?.capabilities} />

      <section className={styles.demoGrid}>
        <DoctorConversationDemo run={run} isProcessing={isProcessing} onProcess={processConversation} />
        <AgentEventStream events={run?.events ?? []} status={run?.status ?? "created"} />
      </section>

      {error ? <div className={`${styles.banner} panel`}>{error}</div> : null}

      <TrialExplorer
        eligibility={run?.eligibility ?? []}
        research={run?.research}
        runId={run?.runId}
        runStatus={run?.status}
        trials={run?.trials ?? []}
        voice={run?.patientVoice ?? []}
      />

      <section className={styles.contentGrid}>
        <ResearchPanel summary={run?.research} />
        <PatientVoicePanel themes={run?.patientVoice ?? []} />
        <EligibilityPanel rows={run?.eligibility ?? []} />
        <Panel title="Questions To Ask" kicker="Coordinator prep">
          <List items={dedupe(questions)} empty="Questions will appear after burden and patient voice agents run." />
        </Panel>
        <Panel title="Source Status" kicker="Live retrieval">
          <SourceStatus run={run} />
        </Panel>
        <ResearchChat run={run} />
        <ArtifactPanel artifacts={run?.artifacts ?? []} />
      </section>
    </main>
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function SourceStatus({ run }: { run: TrialIntelligenceState | null }) {
  if (!run) return <Empty text="Live source status appears after the first run starts." />;
  const items = [
    `Trials: ${run.trials.length} cards from official records`,
    `Research: ${run.research?.papersFound ?? 0} papers and web contexts`,
    `Patient voice: ${run.patientVoice.length} aggregate themes`,
    `Realtime: ${run.events.length} streamed agent events`,
    `Mode: ${run.sourceMode}`,
  ];
  return <List items={items} empty="No source status yet." />;
}
