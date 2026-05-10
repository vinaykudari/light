"use client";

import { useEffect, useState } from "react";
import { lungCancerPatient, lungCancerTranscript } from "@/lib/demo/lungCancerDemo";
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
  const visibleTranscript = lungCancerTranscript.slice(0, visibleCount);
  const complete = visibleCount === 0 || visibleCount >= lungCancerTranscript.length;
  const followUps = run?.conversation?.followUpQuestions ?? [];

  useEffect(() => {
    if (!visibleCount || complete) return;
    const timer = window.setTimeout(() => setVisibleCount((count) => count + 1), 650);
    return () => window.clearTimeout(timer);
  }, [visibleCount, complete]);

  function startConversation() {
    setVisibleCount(1);
  }

  function processConversation() {
    if (!visibleCount) setVisibleCount(lungCancerTranscript.length);
    onProcess({
      patient: toPatientInput(),
      conversationTranscript: lungCancerTranscript,
    });
  }

  return (
    <section className={`${styles.formPanel} panel`}>
      <div className={styles.panelHeader}>
        <Title kicker="Doctor voice" title="Conversation" />
        <div className={styles.buttonRow}>
          <button className={styles.secondaryButton} type="button" onClick={startConversation} disabled={isProcessing}>
            Start
          </button>
          <button className={styles.primaryButton} type="button" onClick={processConversation} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Process"}
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
      {followUps.length ? (
        <section className={styles.subCard}>
          <Title title="Follow-up questions" kicker="Missing info" />
          <List items={followUps} empty="No follow-up questions yet." />
        </section>
      ) : null}
    </section>
  );
}

function toPatientInput(): PatientProfileInput {
  return {
    age: lungCancerPatient.age,
    diagnosis: lungCancerPatient.diagnosis,
    biomarkers: lungCancerPatient.biomarkers,
    priorTherapies: lungCancerPatient.priorTherapies,
    location: lungCancerPatient.location,
    maxTravelMiles: lungCancerPatient.maxTravelMiles,
    preferences: lungCancerPatient.preferences,
    missingDataHints: lungCancerPatient.missingDataHints,
  };
}
