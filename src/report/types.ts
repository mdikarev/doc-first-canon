export type FindingKind = "structure" | "consistency" | "drift" | "conflict" | "discipline";
export type FindingStatus = "open" | "stale";
export type FindingSource = "cli" | "skill";

export interface Finding {
  id: string;
  kind: FindingKind;
  paths: string[];
  summary: string;
  status: FindingStatus;
  source: FindingSource;
  discrepancy_id?: string;
}

export interface Report {
  schema_version: 1;
  generated_at: string;
  findings: Finding[];
}
