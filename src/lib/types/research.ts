export type ResearchPaper = {
  title: string;
  authors?: string[];
  year?: number;
  source: "PubMed" | "Nia" | "Seed";
  url?: string;
  abstract?: string;
  relevanceReason: string;
};

export type ResearchSummary = {
  query: string;
  papersFound: number;
  selectedPapers: ResearchPaper[];
  themes: string[];
  clinicianQuestions: string[];
  limitations: string[];
  sourceMode: "real" | "mixed" | "mock";
};
