import type { FindingKind } from "../report/types.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  message: string;
  kind: FindingKind;
  paths: string[];
  severity: ValidationSeverity;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
