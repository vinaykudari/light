import { redactUnsafeText } from "./filter";

export function removeSocialIdentifiers(value: string): string {
  return redactUnsafeText(value).replace(/\s+/g, " ").trim();
}
