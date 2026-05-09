export type ConversationTurn = {
  speaker: "doctor" | "patient";
  text: string;
};

export type ExtractedConversationProfile = {
  possibleConditionContext: string;
  symptoms: string[];
  duration: string;
  onset: string;
  location: string;
  patientGoal: string;
};

export type ConversationSummary = {
  transcript: ConversationTurn[];
  extractedProfile: ExtractedConversationProfile;
  followUpQuestions: string[];
};
