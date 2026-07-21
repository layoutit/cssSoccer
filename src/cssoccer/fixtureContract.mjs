export const CSSOCCER_FIXTURE_ID = "spain-argentina-full-match";
export const CSSOCCER_MANIFEST_URL = "/cssoccer/manifest.json";

export const CSSOCCER_CONTROL_COUNTRIES = Object.freeze([
  Object.freeze({ id: "spain", label: "Spain" }),
  Object.freeze({ id: "argentina", label: "Argentina" }),
]);

export const CSSOCCER_CONTROL_COUNTRY_IDS = Object.freeze(
  CSSOCCER_CONTROL_COUNTRIES.map(({ id }) => id),
);

export function normalizeControlCountry(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return CSSOCCER_CONTROL_COUNTRY_IDS.includes(normalized) ? normalized : null;
}

export function requireControlCountry(value) {
  const country = normalizeControlCountry(value);
  if (!country) {
    throw new Error("Control country must be exactly spain or argentina.");
  }
  return country;
}
