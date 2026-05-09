import type { SafetyCategory } from "./schemas";

export type SafetyPattern = {
  category: SafetyCategory;
  pattern: RegExp;
  reason: string;
  blocking: boolean;
};

export type RedactionPattern = {
  category: Extract<SafetyCategory, "phi" | "profileData">;
  pattern: RegExp;
  replacement: string;
  reason: string;
};

export const BLOCKING_CATEGORIES: SafetyCategory[] = [
  "medicalAdvice",
  "treatmentRecommendation",
  "finalEligibilityClaim",
];

export const REDACTION_PATTERNS: RedactionPattern[] = [
  {
    category: "phi",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[redacted email]",
    reason: "email address",
  },
  {
    category: "phi",
    pattern: /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g,
    replacement: "[redacted phone]",
    reason: "phone number",
  },
  {
    category: "phi",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[redacted ssn]",
    reason: "social security number",
  },
  {
    category: "phi",
    pattern: /\b(?:mrn|medical record(?: number)?|record id)\s*[:#-]?\s*[A-Z0-9-]{4,}\b/gi,
    replacement: "[redacted record id]",
    reason: "medical record identifier",
  },
  {
    category: "phi",
    pattern: /\b(?:dob|date of birth|born)\s*[:#-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
    replacement: "[redacted date of birth]",
    reason: "date of birth",
  },
  {
    category: "phi",
    pattern: /\b(?:patient|subject)?\s*name\s*[:#-]?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
    replacement: "[redacted name]",
    reason: "patient name",
  },
  {
    category: "phi",
    pattern: /\b\d{1,6}\s+[A-Za-z0-9 .'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct)\b/gi,
    replacement: "[redacted address]",
    reason: "street address",
  },
  {
    category: "profileData",
    pattern: /\b(?:https?:\/\/)?(?:www\.)?(?:x|twitter|reddit|facebook|instagram|linkedin)\.com\/[A-Za-z0-9_./-]+\b/gi,
    replacement: "[redacted profile]",
    reason: "profile URL",
  },
  {
    category: "profileData",
    pattern: /(^|[\s([{])@[A-Za-z0-9_]{2,30}\b/g,
    replacement: "$1[redacted handle]",
    reason: "username or handle",
  },
];

export const SAFETY_PATTERNS: SafetyPattern[] = [
  {
    category: "finalEligibilityClaim",
    pattern: /\b(?:is|are|am|be|been)\s+(?:not\s+)?(?:eligible|ineligible)\s+(?:for|to)\b/i,
    reason: "conclusive trial screening statement",
    blocking: true,
  },
  {
    category: "finalEligibilityClaim",
    pattern: /\b(?:qualifies|qualified|does\s+not\s+qualify|do\s+not\s+qualify)\s+(?:for|to)\b/i,
    reason: "conclusive qualification statement",
    blocking: true,
  },
  {
    category: "finalEligibilityClaim",
    pattern: /\b(?:meets|fails)\s+all\s+(?:inclusion|exclusion|eligibility)\s+criteria\b/i,
    reason: "final criteria decision",
    blocking: true,
  },
  {
    category: "treatmentRecommendation",
    pattern: /\b(?:recommend|recommended|recommendation)\s+(?:starting|stopping|switching|increasing|decreasing|using|taking)\b/i,
    reason: "therapy action recommendation",
    blocking: true,
  },
  {
    category: "treatmentRecommendation",
    pattern: /\b(?:best|preferred|right)\s+(?:drug|medication|treatment|therapy|regimen)\b/i,
    reason: "therapy ranking",
    blocking: true,
  },
  {
    category: "medicalAdvice",
    pattern: /\b(?:you|patient|subject)\s+(?:should|must|need(?:s)?\s+to|ought\s+to)\s+(?:start|stop|take|use|switch|increase|decrease|continue|avoid)\b/i,
    reason: "direct patient care instruction",
    blocking: true,
  },
  {
    category: "medicalAdvice",
    pattern: /\b(?:prescribe|dose|dosage)\b.{0,60}\b(?:mg|tablet|capsule|drug|medication|therapy|treatment)\b/i,
    reason: "medication dosing guidance",
    blocking: true,
  },
];
