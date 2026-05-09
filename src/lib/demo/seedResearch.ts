import type { ResearchPaper } from "@/lib/types";

export const seedResearch: ResearchPaper[] = [
  {
    title: "Targeting EGFR exon 20 insertion mutations in non-small cell lung cancer",
    authors: ["Review authors"],
    year: 2024,
    source: "Seed",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    abstract: "Review context for targeted approaches and resistance questions in EGFR exon 20 insertion NSCLC.",
    relevanceReason: "Gives clinician-review context for EGFR exon 20 treatment landscape and trial rationale.",
  },
  {
    title: "Clinical activity of exon 20 directed therapies after platinum chemotherapy",
    authors: ["Study group"],
    year: 2023,
    source: "Seed",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    abstract: "Summarizes post-platinum treatment patterns, response endpoints, and safety monitoring considerations.",
    relevanceReason: "Matches the synthetic profile's prior platinum-based chemotherapy history.",
  },
  {
    title: "Practical screening barriers in precision oncology trials",
    authors: ["Operations researchers"],
    year: 2022,
    source: "Seed",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    abstract: "Discusses tissue availability, lab timing, travel burden, and coordinator communication gaps.",
    relevanceReason: "Supports burden and missing-data questions before referral.",
  },
];
