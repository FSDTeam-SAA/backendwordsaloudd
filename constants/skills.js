// Skill / trade categories shown on the "What can you do?" onboarding screen.
export const SKILLS = [
  "Phone Tech",
  "Computer Tech",
  "Plumber",
  "Electrician",
  "Carpenter",
  "Joinery",
  "Mobile Mech",
  "Painter",
  "Appliance",
  "AC Tech",
  "Tile Man",
  "Mason",
  "Glass Man",
  "Roofer",
  "Welder/Gate",
  "Pool Cleaner",
  "Tree Cutter",
  "Landscaper",
  "Auto Body",
  "Contractor",
  "Maid Service",
  "Caterer"
];

// Travel range options on the "What can you work?" onboarding screen.
export const TRAVEL_RANGES = [
  "5km - Local only",
  "Trinidad wide",
  "T&T wide",
];

export const RATE_UNITS = ["Per day", "Per hour", "Per job"];

// Maps loose/casual input ("hour", "25km", "trinidad wide") to the exact
// canonical enum string stored in the DB. Returns null if nothing matches.
export const normalizeTravelRange = (value) => {
  if (!value || typeof value !== "string") return null;

  const v = value.toLowerCase().replace(/\s+/g, " ").trim();

  if (v.includes("t&t") || v.includes("both island") || v === "tt wide") {
    return "T&T wide";
  }
  if (v.includes("trinidad")) {
    return "Trinidad wide";
  }
  if (v.includes("local") || v.includes("5km") || v.includes("5 km") || v.startsWith("5")) {
    return "5km - Local only";
  }

  // exact match fallback (case-insensitive)
  return TRAVEL_RANGES.find((r) => r.toLowerCase() === v) || null;
};

export const normalizeRateUnit = (value) => {
  if (!value || typeof value !== "string") return null;

  const v = value.toLowerCase().replace(/\s+/g, " ").trim();

  if (v.includes("hour") || v.includes("hr")) return "Per hour";
  if (v.includes("day")) return "Per day";
  if (v.includes("job")) return "Per job";

  return RATE_UNITS.find((r) => r.toLowerCase() === v) || null;
};