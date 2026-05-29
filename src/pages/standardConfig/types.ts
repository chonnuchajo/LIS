export const STANDARD_UNITS = ['ml', 'µL', 'ppm', 'mg'] as const;
export type StandardUnit = (typeof STANDARD_UNITS)[number];

export const MATCH_TYPES = ['substring', 'substance', 'commonName'] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const OVERRIDE_SCOPES = ['substanceOnly', 'wholeCommonName'] as const;
export type OverrideScope = (typeof OVERRIDE_SCOPES)[number];

export type InstrumentConfig = {
  enabled: boolean;
  unit: StandardUnit;
  slots: number[];
};

export type StandardConfigDoc = {
  _id: string;
  name: string;
  nameLower: string;
  isManual: boolean;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type StandardOverrideDoc = {
  _id: string;
  matchType: MatchType;
  matchValue: string;
  matchValueLower: string;
  scope: OverrideScope;
  note: string;
  priority: number;
  gc: InstrumentConfig;
  hplc: InstrumentConfig;
  createdAt?: string;
  updatedAt?: string;
};

export type SyncResult = { added: number; updated: number };
