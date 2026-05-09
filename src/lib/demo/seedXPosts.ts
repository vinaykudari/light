import type { PatientVoicePost, PatientVoiceTheme } from "@/lib/types";

export const seedXPosts: PatientVoicePost[] = [
  {
    id: "seed-voice-1",
    source: "seed",
    text: "Synthetic signal: trial screening felt stressful because biopsy timing and tissue requirements were unclear.",
  },
  {
    id: "seed-voice-2",
    source: "seed",
    text: "Synthetic signal: families asked about parking, travel reimbursement, and caregiver time off for frequent visits.",
  },
  {
    id: "seed-voice-3",
    source: "seed",
    text: "Synthetic signal: patients wanted plain-language expectations about infusion visits, labs, and fatigue tracking.",
  },
];

export const seedVoiceThemes: PatientVoiceTheme[] = [
  {
    theme: "Biopsy and tissue uncertainty",
    sentiment: "mixed",
    signalStrength: "medium",
    summary: "Synthetic public-patient signals emphasize confusion about whether archival tissue is enough or a new biopsy is needed.",
    coordinatorQuestion: "Will screening require a fresh biopsy, or can archival pathology and genomics reports be used?",
    sourceCount: 4,
  },
  {
    theme: "Travel and caregiver burden",
    sentiment: "negative",
    signalStrength: "medium",
    summary: "Synthetic signals raise practical concerns about repeat visits, parking, time off work, and caregiver scheduling.",
    coordinatorQuestion: "What visit cadence should the patient expect, and is any travel, parking, or lodging reimbursement available?",
    sourceCount: 5,
  },
  {
    theme: "Plain-language screening expectations",
    sentiment: "neutral",
    signalStrength: "low",
    summary: "Synthetic signals suggest patients want concise explanations of labs, scans, infusion timing, and who coordinates records.",
    coordinatorQuestion: "Can the study team provide a simple screening checklist and expected first-month schedule?",
    sourceCount: 3,
  },
];
