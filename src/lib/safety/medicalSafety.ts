import { filterUnsafeContent } from "./filter";
import { removeSocialIdentifiers } from "./pii";

const replacements: Array<[RegExp, string]> = [
  [/\byou are eligible\b/gi, "final eligibility must be confirmed by the study team"],
  [/\byou should enroll\b/gi, "this may be worth discussing with a clinician"],
  [/\byou should join\b/gi, "this may be worth discussing with a clinician"],
  [/\bthis treatment is best\b/gi, "treatment choices require clinician review"],
  [/\bthis treatment is better\b/gi, "comparative treatment claims require clinician review"],
  [/\bwill cause\b/gi, "may be associated with, based on source review"],
  [/\bis safe for you\b/gi, "requires clinician and study-team review"],
];

export function applyMedicalSafety(value: string): string {
  let output = removeSocialIdentifiers(value);
  for (const [pattern, replacement] of replacements) {
    output = output.replace(pattern, replacement);
  }
  const result = filterUnsafeContent(output);
  output = result.allowed
    ? result.safeText
    : "Safety review withheld generated content for coordinator review.";

  return output;
}
