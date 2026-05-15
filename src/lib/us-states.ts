// =============================================================================
// src/lib/us-states.ts
// =============================================================================
// Canonical list of state dropdown options for "current state" fields on
// contacts and alumni claims. Stored here so the alumni signup form and
// the admin contact form stay in sync.
//
// Order: all 50 US states alphabetically, then "International" and "Other"
// pinned at the bottom. The bottom options are visually-distinct catch-alls
// so non-US alumni or people who'd rather not say have a path.
//
// Stored as plain text in the database (not as a Postgres enum) so the
// dropdown can evolve without schema migrations. If "DC" or "Puerto Rico"
// is ever requested, just add it here.
// =============================================================================

export const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

export const STATE_OPTIONS_FOR_DROPDOWN = [
  ...US_STATES,
  "International",
  "Other",
] as const;
