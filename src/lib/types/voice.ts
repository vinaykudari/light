export type PatientVoicePost = {
  id: string;
  text: string;
  source: "x" | "web" | "seed";
  url?: string;
  title?: string;
};

export type PatientVoiceSource = {
  title: string;
  url?: string;
  source: "x" | "web" | "seed";
  snippet?: string;
};

export type PatientVoiceTheme = {
  theme: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  signalStrength: "low" | "medium" | "high";
  summary: string;
  coordinatorQuestion: string;
  sourceCount: number;
  sources?: PatientVoiceSource[];
};
