import type {
  DocumentExtraction,
  PublicationRecord,
  ResearchInsight,
  SocialPost,
  TrialRecord,
} from "@/lib/adapters/types";

export const seededTrials: TrialRecord[] = [
  {
    id: "seed-nct-als-platform",
    nctId: "NCT04297683",
    title: "Platform trial evaluating candidate therapies for ALS",
    status: "RECRUITING",
    phase: "PHASE2/PHASE3",
    conditions: ["Amyotrophic lateral sclerosis"],
    interventions: ["Adaptive investigational therapy arms", "Placebo comparator"],
    sponsor: "Academic medical center network",
    locations: ["United States multi-site"],
    eligibilitySummary: "Adults with ALS meeting functional and safety criteria.",
    lastUpdated: "2026-03-15",
    url: "https://clinicaltrials.gov/study/NCT04297683",
  },
  {
    id: "seed-nct-breast-ctdna",
    nctId: "NCT04985266",
    title: "ctDNA-guided treatment escalation in metastatic breast cancer",
    status: "ACTIVE_NOT_RECRUITING",
    phase: "PHASE2",
    conditions: ["Metastatic breast cancer"],
    interventions: ["Molecular residual disease monitoring", "Targeted therapy"],
    sponsor: "Cancer research consortium",
    locations: ["United States", "Canada"],
    eligibilitySummary: "Patients with measurable metastatic disease and available tissue.",
    lastUpdated: "2026-02-08",
    url: "https://clinicaltrials.gov/study/NCT04985266",
  },
  {
    id: "seed-nct-egfr-exon20",
    nctId: "NCT05331365",
    title: "Targeted therapy study for advanced NSCLC with EGFR exon 20 insertion",
    status: "RECRUITING",
    phase: "PHASE2",
    conditions: ["Non-small cell lung cancer", "EGFR exon 20 insertion"],
    interventions: ["Investigational targeted therapy"],
    sponsor: "Oncology research network",
    locations: ["California", "United States multi-site"],
    eligibilitySummary: "Adults with advanced NSCLC, EGFR exon 20 insertion, prior systemic therapy, and study-team screening.",
    lastUpdated: "2026-04-02",
    url: "https://clinicaltrials.gov/search?term=EGFR%20exon%2020%20NSCLC",
  },
];

export const seededPublications: PublicationRecord[] = [
  {
    id: "seed-pub-precision-oncology",
    pmid: "38900001",
    title: "Adaptive evidence generation for precision oncology trials",
    journal: "Journal of Clinical Oncology",
    publishedAt: "2026 Jan",
    authors: ["Patel R", "Nguyen M", "Harris A"],
    doi: "10.1200/example.precision",
    url: "https://pubmed.ncbi.nlm.nih.gov/38900001/",
    summary: "Reviews basket, umbrella, and ctDNA-guided trial designs.",
  },
  {
    id: "seed-pub-patient-reported",
    pmid: "38900002",
    title: "Patient-reported outcomes in decentralized clinical trials",
    journal: "Clinical Trials",
    publishedAt: "2026 Feb",
    authors: ["Smith J", "Lopez D"],
    doi: "10.1177/example.pro",
    url: "https://pubmed.ncbi.nlm.nih.gov/38900002/",
    summary: "Summarizes remote monitoring, adherence, and digital endpoint risks.",
  },
  {
    id: "seed-pub-rare-disease",
    pmid: "38900003",
    title: "Rare disease trial recruitment using registry-linked natural history data",
    journal: "Orphanet Journal of Rare Diseases",
    publishedAt: "2026 Mar",
    authors: ["Khan S", "Miller T", "Chen L"],
    doi: "10.1186/example.registry",
    url: "https://pubmed.ncbi.nlm.nih.gov/38900003/",
    summary: "Compares eligibility screening strategies across small patient populations.",
  },
];

export const seededPosts: SocialPost[] = [
  {
    id: "seed-x-caregiver-fatigue",
    text: "Caregiver report: trial visits are manageable when labs and symptom surveys can be completed locally.",
    createdAt: "2026-04-25T16:40:00Z",
    sourceLabel: "Public patient voice",
    metrics: { likes: 18, replies: 4, reposts: 3 },
  },
  {
    id: "seed-x-egfr-exon20",
    text: "Patient discussion highlights biopsy requirements, scan timing, and travel logistics as key questions before oncology trial screening.",
    createdAt: "2026-04-18T09:10:00Z",
    sourceLabel: "Public patient voice",
    metrics: { likes: 41, replies: 8, reposts: 7 },
  },
  {
    id: "seed-x-oncology",
    text: "Community thread: people want trial pages to state biopsy requirements and travel expectations up front.",
    createdAt: "2026-04-10T22:05:00Z",
    sourceLabel: "Public patient voice",
    metrics: { likes: 29, replies: 6, reposts: 5 },
  },
];

export const seededInsights: ResearchInsight[] = [
  {
    id: "seed-insight-eligibility",
    title: "Eligibility friction",
    snippet: "Fallback synthesis flags travel burden, biopsy requirements, and washout periods as common barriers.",
    source: "seeded evidence pack",
    score: 0.78,
  },
  {
    id: "seed-insight-endpoints",
    title: "Endpoint fit",
    snippet: "Digital symptom diaries can complement clinical scales when visit cadence is sparse.",
    source: "seeded evidence pack",
    score: 0.72,
  },
];

export const seededExtraction: DocumentExtraction = {
  id: "seed-extraction-protocol",
  status: "successful",
  title: "Seeded protocol extraction",
  source: "seeded document parser",
  chunks: [
    "Inclusion: confirmed diagnosis, stable baseline medication, ability to complete remote surveys.",
    "Operational note: local labs and telehealth screening reduce patient travel burden.",
  ],
  structured: {
    inclusion: ["confirmed diagnosis", "stable baseline medication"],
    barriers: ["travel burden", "biopsy requirements", "washout periods"],
  },
};
