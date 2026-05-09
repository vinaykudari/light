export type PatientProfile = {
  id: string;
  age?: number;
  diagnosis: string;
  possibleConditionContext?: string;
  symptoms?: string[];
  duration?: string;
  onset?: string;
  patientGoal?: string;
  biomarkers: string[];
  priorTherapies: string[];
  location: string;
  maxTravelMiles: number;
  preferences: string[];
  missingDataHints: string[];
};

export type PatientProfileInput = Omit<PatientProfile, "id"> & {
  id?: string;
};
