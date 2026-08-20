export type SectionRole =
  | "index"
  | "overview"
  | "architecture"
  | "glossary"
  | "discrepancies"
  | "contract"
  | "section";

export interface SectionDef {
  id: string;
  path: string; // relative to docs/canon/
  role: SectionRole;
  required: boolean;
  template: string; // template id
}

export interface TemplateDef {
  id: string;
  path: string; // relative to docs/canon/
}

export interface Policies {
  max_lines: number;
  /** Optional per-line character cap for registered canon sections. */
  max_line_length?: number;
  ignore: string[];
}

export interface Contract {
  schema_version: number;
  cli_compat: string; // semver range or min version string, e.g. ">=0.1.0"
  skills_stamp: string;
  sections: SectionDef[];
  templates: TemplateDef[];
  policies: Policies;
}
