"use client";

import { useEffect, useState } from "react";
import type { TrialIntelligenceState } from "@/lib/types";
import { AgentEventStream } from "./AgentEventStream";
import { ArtifactPanel } from "./ArtifactPanel";
import { DoctorConversationDemo, type ConversationPayload } from "./DoctorConversationDemo";
import { EligibilityPanel } from "./EligibilityPanel";
import { PatientVoicePanel } from "./PatientVoicePanel";
import { ResearchChat } from "./ResearchChat";
import { ResearchPanel } from "./ResearchPanel";
import { SafetyBanner } from "./SafetyBanner";
import { TrialExplorer } from "./TrialExplorer";
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

  const statusLabel = run ? `${run.status} / ${run.sourceMode}` : "ready";

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

  return (
    <main className="shell">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Light</p>
          <h1>Trial intelligence</h1>
          <p className="muted">
            Live agents turn a doctor conversation into trial matches, evidence, patient and expert signals, and referral prep.
          </p>
        </div>
        <div className={styles.sourceMode} aria-live="polite">
          <span className={isProcessing ? styles.pulse : styles.dot} />
          {statusLabel}
        </div>
      </header>

      <SafetyBanner />

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
        expertSources={run?.expertSources ?? []}
      />

      <section className={styles.contentGrid}>
        <ResearchPanel summary={run?.research} />
        <PatientVoicePanel themes={run?.patientVoice ?? []} expertSources={run?.expertSources ?? []} />
        <EligibilityPanel rows={run?.eligibility ?? []} />
        <ResearchChat run={run} />
        <ArtifactPanel artifacts={run?.artifacts ?? []} />
      </section>
    </main>
  );
}
