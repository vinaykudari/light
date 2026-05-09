"use client";

import { useEffect, useMemo, useState } from "react";
import { seedPatient } from "@/lib/demo/seedPatient";
import type { PatientProfile, PatientProfileInput, TrialIntelligenceState } from "@/lib/types";
import { AgentEventStream } from "./AgentEventStream";
import { ArtifactPanel } from "./ArtifactPanel";
import { EligibilityPanel } from "./EligibilityPanel";
import { PatientProfileForm, type PatientFormState } from "./PatientProfileForm";
import { PatientVoicePanel } from "./PatientVoicePanel";
import { ResearchPanel } from "./ResearchPanel";
import { SafetyBanner } from "./SafetyBanner";
import { TrialCard } from "./TrialCard";
import { Empty, List, Panel } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export function LightDashboard() {
  const [form, setForm] = useState<PatientFormState>(toForm(seedPatient));
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

  async function processIntelligence() {
    setError(null);
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient: toPatientInput(form) }),
    });
    if (!response.ok) {
      setError("Run could not be started.");
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
          <p className={styles.eyebrow}>Light</p>
          <h1>Clinical trial intelligence from evidence + patient voice</h1>
          <p className="muted">
            Synthetic patient context, official trial records, research evidence, public patient-experience signals, and referral-prep artifacts.
          </p>
        </div>
        <div className={styles.sourceMode} aria-live="polite">
          <span className={isProcessing ? styles.pulse : styles.dot} />
          Source mode: {sourceMode}
        </div>
      </header>

      <SafetyBanner />

      <section className={styles.topGrid}>
        <PatientProfileForm
          form={form}
          isProcessing={isProcessing}
          onChange={setForm}
          onSubmit={processIntelligence}
        />
        <AgentEventStream events={run?.events ?? []} status={run?.status ?? "created"} />
      </section>

      {error ? <div className={`${styles.banner} panel`}>{error}</div> : null}

      <section className={styles.contentGrid}>
        <Panel title="Trial Matches" kicker="Shortlist">
          <div className={styles.trialStack}>
            {(run?.trials ?? []).map((trial) => <TrialCard key={trial.nctId} trial={trial} />)}
            {!run?.trials.length ? <Empty text="Click Process to create a trial shortlist." /> : null}
          </div>
        </Panel>
        <ResearchPanel summary={run?.research} />
        <PatientVoicePanel themes={run?.patientVoice ?? []} />
        <EligibilityPanel rows={run?.eligibility ?? []} />
        <Panel title="Questions To Ask" kicker="Visit prep">
          <List items={dedupe(questions)} empty="Questions will appear after burden and patient voice agents run." />
        </Panel>
        <ArtifactPanel artifacts={run?.artifacts ?? []} />
      </section>
    </main>
  );
}

function toForm(patient: PatientProfile): PatientFormState {
  return {
    diagnosis: patient.diagnosis,
    biomarkers: patient.biomarkers.join(", "),
    priorTherapies: patient.priorTherapies.join(", "),
    location: patient.location,
    maxTravelMiles: String(patient.maxTravelMiles),
    preferences: patient.preferences.join("\n"),
    missingDataHints: patient.missingDataHints.join("\n"),
  };
}

function toPatientInput(form: PatientFormState): PatientProfileInput {
  return {
    diagnosis: form.diagnosis,
    biomarkers: splitList(form.biomarkers),
    priorTherapies: splitList(form.priorTherapies),
    location: form.location,
    maxTravelMiles: Number(form.maxTravelMiles) || seedPatient.maxTravelMiles,
    preferences: splitList(form.preferences),
    missingDataHints: splitList(form.missingDataHints),
  };
}

function splitList(value: string): string[] {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
