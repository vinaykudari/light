export type TrialLocation = {
  facility?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type TrialCard = {
  nctId: string;
  title: string;
  status: string;
  phase?: string;
  locations: TrialLocation[];
  distanceMiles?: number;
  matchedCriteria: string[];
  missingCriteria: string[];
  exclusionRisks: string[];
  coordinatorQuestions: string[];
  sourceUrl?: string;
  source: "clinicaltrials.gov" | "seed";
};

export type EligibilityRow = {
  trialId: string;
  trialTitle: string;
  matchedCriteria: string[];
  missingData: string[];
  possibleExclusionRisks: string[];
  reviewNote: string;
};
