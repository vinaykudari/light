import type { ConversationTurn, PatientProfile } from "@/lib/types";

export const lungCancerTranscript: ConversationTurn[] = [
  { speaker: "doctor", text: "Tell me what you are trying to figure out." },
  { speaker: "patient", text: "I have metastatic non-small cell lung cancer with an EGFR exon 20 insertion. I already had platinum-based chemotherapy, and my clinician said clinical trials may be worth discussing." },
  { speaker: "doctor", text: "What would you want Light to help you prepare for?" },
  { speaker: "patient", text: "I want to know which clinical trials might fit this profile and what questions to ask before referral. I am worried about biopsy requirements, how often visits happen, and whether travel reimbursement is available." },
  { speaker: "doctor", text: "Where are you located, and how far can you travel?" },
  { speaker: "patient", text: "I am in San Francisco. I can travel about 50 miles, but I want to avoid overnight stays and I prefer Friday visits if possible." },
  { speaker: "doctor", text: "What pre-screening details are still missing?" },
  { speaker: "patient", text: "I do not have ECOG performance status, latest creatinine clearance, or confirmation that any brain metastases are stable." },
];

export const lungCancerClinicalNoteTranscript: ConversationTurn[] = [
  {
    speaker: "doctor",
    text: "Uploaded synthetic clinical note. Adult patient in San Francisco with metastatic non-small cell lung cancer and EGFR exon 20 insertion. Prior therapy includes platinum-based chemotherapy.",
  },
  {
    speaker: "patient",
    text: "Patient goal is to identify clinical trials worth discussing with the treating clinician and study coordinator. Practical concerns include biopsy requirements, visit frequency, travel burden, Friday visit preference, avoiding overnight stays, and travel reimbursement.",
  },
  {
    speaker: "doctor",
    text: "Missing pre-screening information includes ECOG performance status, latest creatinine clearance, brain metastases stability, prior therapy dates, current medication stability, pathology report, genomics report, and whether additional tissue or blood collection is required.",
  },
];

export const lungCancerPatient: PatientProfile = {
  id: "lung-cancer-demo",
  age: 58,
  diagnosis: "metastatic non-small cell lung cancer with EGFR exon 20 insertion",
  biomarkers: ["EGFR exon 20 insertion"],
  priorTherapies: ["platinum-based chemotherapy"],
  location: "San Francisco, CA",
  maxTravelMiles: 50,
  preferences: [
    "avoid overnight stays",
    "prefers Friday visits",
    "wants to understand biopsy requirements",
    "wants to understand travel reimbursement",
  ],
  missingDataHints: [
    "ECOG performance status",
    "latest creatinine clearance",
    "brain metastases stability",
  ],
};

export const lungCancerFollowUpQuestions = [
  "Was EGFR exon 20 insertion confirmed on a pathology or genomics report?",
  "What are the prior therapy dates and response or progression details?",
  "What is the current ECOG performance status?",
  "What is the latest creatinine clearance and key lab status?",
  "Are brain metastases present, and if so are they stable?",
  "Is archival tissue available, or would a new biopsy be required?",
  "Are current medications stable?",
  "Can the patient attend multiple in-person visits within 50 miles?",
];
