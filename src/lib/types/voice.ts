export type PatientVoicePost = {
  id: string;
  text: string;
  source: "x" | "seed";
};

export type PatientVoiceTheme = {
  theme: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  signalStrength: "low" | "medium" | "high";
  summary: string;
  coordinatorQuestion: string;
  sourceCount: number;
};
