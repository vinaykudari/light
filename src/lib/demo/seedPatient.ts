import type { PatientProfile } from "@/lib/types";

export const seedPatient: PatientProfile = {
  id: "synthetic-nsclc-egfr20-sf",
  diagnosis: "metastatic non-small cell lung cancer",
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
