import type { ConversationTurn, PatientProfile } from "@/lib/types";

export const longCovidTranscript: ConversationTurn[] = [
  { speaker: "doctor", text: "Tell me what has been going on." },
  { speaker: "patient", text: "I had COVID about 8 months ago. Since then I have had bad brain fog. I forget words in meetings, I get exhausted after small tasks, and if I go for even a short walk I sometimes crash for a day or two." },
  { speaker: "doctor", text: "When you say crash, do symptoms get worse after activity?" },
  { speaker: "patient", text: "Yeah. It is like delayed exhaustion. Also when I stand up, my heart races and I feel dizzy. Sleep is bad too." },
  { speaker: "doctor", text: "Are you in the Bay Area, and are you interested in research studies if your doctor thinks it is appropriate?" },
  { speaker: "patient", text: "Yes, I am in San Francisco. I just want to know what to ask my doctor." },
];

export const longCovidClinicalNoteTranscript: ConversationTurn[] = [
  {
    speaker: "doctor",
    text: "Uploaded synthetic clinical note. Patient is a 34-year-old adult in San Francisco, California. COVID infection occurred approximately 8 months ago by home antigen testing per patient report. Since infection, symptoms have persisted longer than 3 months.",
  },
  {
    speaker: "patient",
    text: "Reported symptoms include brain fog with word-finding difficulty during meetings, crushing fatigue after small tasks, delayed post-exertional crash for one to two days after short walks, dizziness and fast heart rate when standing, and poor sleep.",
  },
  {
    speaker: "doctor",
    text: "Patient goal: wants to know which research studies or clinical trial options may be worth discussing with their clinician. Missing pre-screening details include documented COVID history, hospitalization or ICU status, medication stability, other diagnoses that could explain symptoms, visit feasibility, blood collection willingness, and recent vaccination or medication changes.",
  },
];

export const longCovidPatient: PatientProfile = {
  id: "conversation-demo",
  age: 34,
  diagnosis: "symptom conversation pending",
  biomarkers: [],
  priorTherapies: ["none documented in demo conversation"],
  location: "San Francisco, CA",
  maxTravelMiles: 50,
  preferences: ["wants doctor-reviewed research study options", "prefers low-burden visits", "wants to understand symptom measurement"],
  missingDataHints: [],
};

export const longCovidFollowUpQuestions = [
  "Was COVID documented by test or clinical diagnosis?",
  "Did symptoms begin or worsen after infection?",
  "Were you hospitalized or admitted to ICU for COVID?",
  "Are current medications stable?",
  "Any major pre-existing condition that better explains the symptoms?",
  "Are you willing or able to attend multiple study visits?",
  "Are you willing to do blood collection if required?",
  "Any recent vaccination or medication changes if trial criteria ask about it?",
];
