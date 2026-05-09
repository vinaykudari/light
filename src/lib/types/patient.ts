export type PatientProfile = {
  id: string;
  diagnosis: string;
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
