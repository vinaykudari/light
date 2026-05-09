import { searchSeededTrials } from "@/lib/demo";
import type { AdapterResult, TrialRecord, TrialSearchInput } from "./types";
import {
  asArray,
  asRecord,
  asString,
  buildUrl,
  clamp,
  compact,
  fetchJson,
  reasonFromError,
  stringArray,
} from "./http";
import { cleanOptionalText, cleanText } from "./privacy";

const SOURCE = "ClinicalTrials.gov";
const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";

export async function searchClinicalTrials(
  input: TrialSearchInput,
): Promise<AdapterResult<TrialRecord>> {
  const maxResults = clamp(input.pageSize ?? input.maxResults, 10, 1, 50);

  try {
    const url = buildUrl(BASE_URL, {
      format: "json",
      pageSize: maxResults,
      "query.term": input.query || input.condition,
      "query.cond": input.condition,
      "query.locn": input.location,
      "filter.overallStatus": input.statuses,
    });
    const data = await fetchJson<unknown>(url);
    const items = asArray(asRecord(data).studies)
      .map(mapStudy)
      .filter((item): item is TrialRecord => Boolean(item))
      .slice(0, maxResults);

    return {
      source: SOURCE,
      mode: "active",
      fetchedAt: new Date().toISOString(),
      items,
    };
  } catch (error) {
    return fallbackClinicalTrials(input, reasonFromError(error), maxResults);
  }
}

function fallbackClinicalTrials(
  input: TrialSearchInput,
  reason: string,
  maxResults: number,
): AdapterResult<TrialRecord> {
  return {
    source: SOURCE,
    mode: "fallback",
    reason,
    fetchedAt: new Date().toISOString(),
    items: searchSeededTrials(`${input.query} ${input.condition ?? ""}`, maxResults),
  };
}

function mapStudy(value: unknown): TrialRecord | undefined {
  const study = asRecord(value);
  const protocol = asRecord(study.protocolSection);
  const identification = asRecord(protocol.identificationModule);
  const status = asRecord(protocol.statusModule);
  const design = asRecord(protocol.designModule);
  const conditions = asRecord(protocol.conditionsModule);
  const arms = asRecord(protocol.armsInterventionsModule);
  const sponsor = asRecord(protocol.sponsorCollaboratorsModule);
  const eligibility = asRecord(protocol.eligibilityModule);
  const contacts = asRecord(protocol.contactsLocationsModule);
  const nctId = asString(identification.nctId);

  if (!nctId) {
    return undefined;
  }

  return {
    id: nctId,
    nctId,
    title: cleanText(identification.briefTitle ?? identification.officialTitle, 240),
    status: cleanText(status.overallStatus ?? "UNKNOWN", 80),
    phase: stringArray(design.phases).join("/") || undefined,
    conditions: stringArray(conditions.conditions).map((item) => cleanText(item, 120)),
    interventions: mapInterventions(arms.interventions),
    sponsor: cleanOptionalText(asRecord(sponsor.leadSponsor).name, 160),
    locations: mapLocations(contacts.locations),
    eligibilitySummary: cleanOptionalText(eligibility.eligibilityCriteria, 360),
    lastUpdated: cleanOptionalText(asRecord(status.lastUpdateSubmitDateStruct).date, 40),
    url: `https://clinicaltrials.gov/study/${encodeURIComponent(nctId)}`,
  };
}

function mapInterventions(value: unknown): string[] {
  return asArray(value)
    .map((item) => cleanOptionalText(asRecord(item).name, 120))
    .filter((item): item is string => Boolean(item))
    .slice(0, 8);
}

function mapLocations(value: unknown): string[] {
  return asArray(value)
    .map((item) => {
      const location = asRecord(item);
      return compact([
        cleanOptionalText(location.facility, 120),
        cleanOptionalText(location.city, 80),
        cleanOptionalText(location.state, 80),
        cleanOptionalText(location.country, 80),
      ]).join(", ");
    })
    .filter(Boolean)
    .slice(0, 8);
}
