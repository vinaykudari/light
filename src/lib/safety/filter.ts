import {
  BLOCKING_CATEGORIES,
  REDACTION_PATTERNS,
  SAFETY_PATTERNS,
} from "./patterns";
import {
  SafetyFilterResultSchema,
  type SafetyCategory,
  type SafetyFilterResult,
  type SafetyFinding,
} from "./schemas";

const BLOCKING_CATEGORY_SET = new Set<SafetyCategory>(BLOCKING_CATEGORIES);

function uniqueCategories(findings: SafetyFinding[]): SafetyCategory[] {
  return Array.from(new Set(findings.map((finding) => finding.category)));
}

function scanRedactableContent(text: string): SafetyFinding[] {
  return REDACTION_PATTERNS.flatMap((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(text)
      ? [{ category: rule.category, reason: rule.reason, blocking: false }]
      : [];
  });
}

export function scanSafety(text: string): SafetyFinding[] {
  const blockingFindings = SAFETY_PATTERNS.flatMap((rule) => {
    rule.pattern.lastIndex = 0;
    return rule.pattern.test(text)
      ? [{ category: rule.category, reason: rule.reason, blocking: true }]
      : [];
  });

  return [...scanRedactableContent(text), ...blockingFindings];
}

export function redactUnsafeText(text: string): string {
  return REDACTION_PATTERNS.reduce(
    (safeText, rule) => safeText.replace(rule.pattern, rule.replacement),
    text,
  );
}

export function filterUnsafeContent(text: string): SafetyFilterResult {
  const originalFindings = scanRedactableContent(text);
  const redactedText = redactUnsafeText(text);
  const findings = [...originalFindings, ...scanSafety(redactedText)];
  const dedupedFindings = findings.filter(
    (finding, index) =>
      findings.findIndex(
        (candidate) =>
          candidate.category === finding.category &&
          candidate.reason === finding.reason,
      ) === index,
  );
  const hasBlockingFinding = dedupedFindings.some((finding) =>
    BLOCKING_CATEGORY_SET.has(finding.category),
  );
  const result = {
    allowed: !hasBlockingFinding,
    redacted: redactedText !== text,
    categories: uniqueCategories(dedupedFindings),
    findings: dedupedFindings,
    safeText: hasBlockingFinding
      ? "Safety review withheld generated content for coordinator review."
      : redactedText,
    message: hasBlockingFinding
      ? "Unsafe medical, treatment, or trial-screening content was blocked."
      : undefined,
  };

  return SafetyFilterResultSchema.parse(result);
}

export function assertSafeContent(text: string): string {
  const result = filterUnsafeContent(text);

  if (!result.allowed) {
    throw new Error(result.message ?? "Unsafe content blocked.");
  }

  return result.safeText;
}
