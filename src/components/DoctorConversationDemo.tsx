"use client";

import { useEffect, useMemo, useState } from "react";
import { longCovidPatient, longCovidTranscript } from "@/lib/demo/longCovidDemo";
import type { ConversationTurn, PatientProfileInput, TrialIntelligenceState } from "@/lib/types";
import { Empty, List, Title } from "./DisplayPrimitives";
import styles from "./LightDashboard.module.css";

export type ConversationPayload = {
  patient: PatientProfileInput;
  conversationTranscript: ConversationTurn[];
};

export function DoctorConversationDemo({
  run,
  isProcessing,
  onProcess,
}: {
  run: TrialIntelligenceState | null;
  isProcessing: boolean;
  onProcess: (payload: ConversationPayload) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const visibleTranscript = longCovidTranscript.slice(0, visibleCount);
  const complete = visibleCount >= longCovidTranscript.length;
  const extracted = run?.conversation?.extractedProfile;
  const followUps = run?.conversation?.followUpQuestions ?? [];

  useEffect(() => {
    if (!visibleCount || complete) return;
    const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), 650);
    return () => window.clearTimeout(timer);
  }, [visibleCount, complete]);

  const profileLines = useMemo(() => extracted ? [
    `Context: ${extracted.possibleConditionContext}`,
    `Symptoms: ${extracted.symptoms.join(", ")}`,
    `Duration: ${extracted.duration}`,
    `Onset: ${extracted.onset}`,
    `Location: ${extracted.location}`,
    `Goal: ${extracted.patientGoal}`,
  ] : [], [extracted]);

  function startConversation() {
    setVisibleCount(1);
  }

  function processConversation() {
    onProcess({
      patient: toPatientInput(),
      conversationTranscript: longCovidTranscript,
    });
  }

  return (
    <section className={`${styles.formPanel} panel`}>
      <div className={styles.panelHeader}>
        <Title kicker="Doctor voice" title="Live Doctor Conversation Demo" />
        <div className={styles.buttonRow}>
          <button className={styles.secondaryButton} type="button" onClick={startConversation} disabled={isProcessing}>
            Start Demo Conversation
          </button>
          <button className={styles.primaryButton} type="button" onClick={processConversation} disabled={!complete || isProcessing}>
            Process Conversation
          </button>
        </div>
      </div>
      <div className={styles.transcriptList} aria-live="polite">
        {visibleTranscript.map((turn, index) => (
          <article className={styles.transcriptTurn} data-speaker={turn.speaker} key={`${turn.speaker}-${index}`}>
            <strong>{turn.speaker === "doctor" ? "Doctor voice agent" : "Synthetic patient"}</strong>
            <p>{turn.text}</p>
          </article>
        ))}
        {!visibleTranscript.length ? <Empty text="Start the demo conversation to stream the transcript." /> : null}
      </div>
      <div className={styles.profileMiniGrid}>
        <section className={styles.subCard}>
          <Title title="Extracted Profile" kicker="Conversation agent" />
          <List items={profileLines} empty="Process the conversation to extract a structured profile." />
        </section>
        <section className={styles.subCard}>
          <Title title="Follow-Up Questions" kicker="Missing info" />
          <List items={followUps} empty="Questions will appear after the conversation agent runs." />
        </section>
      </div>
    </section>
  );
}

function toPatientInput(): PatientProfileInput {
  return {
    age: longCovidPatient.age,
    diagnosis: longCovidPatient.diagnosis,
    biomarkers: longCovidPatient.biomarkers,
    priorTherapies: longCovidPatient.priorTherapies,
    location: longCovidPatient.location,
    maxTravelMiles: longCovidPatient.maxTravelMiles,
    preferences: longCovidPatient.preferences,
    missingDataHints: longCovidPatient.missingDataHints,
  };
}
