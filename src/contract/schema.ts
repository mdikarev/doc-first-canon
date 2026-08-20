import { DEFAULT_SCHEMA_VERSION, PACKAGE_VERSION } from "../version.js";
import type {
  Contract,
  Policies,
  SectionDef,
  SectionRole,
  TemplateDef,
} from "./types.js";

const SECTION_ROLES = new Set<SectionRole>([
  "index",
  "overview",
  "architecture",
  "glossary",
  "discrepancies",
  "contract",
  "section",
]);

const KNOWN_KEYS = new Set([
  "schema_version",
  "cli_compat",
  "skills_stamp",
  "sections",
  "templates",
  "policies",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function assertSection(value: unknown, index: number): SectionDef {
  if (!isRecord(value)) {
    throw new Error(`sections[${index}] must be an object`);
  }

  const role = value.role;
  if (typeof role !== "string" || !SECTION_ROLES.has(role as SectionRole)) {
    throw new Error(`sections[${index}].role must be a valid SectionRole`);
  }

  if (typeof value.required !== "boolean") {
    throw new Error(`sections[${index}].required must be a boolean`);
  }

  return {
    id: assertString(value.id, `sections[${index}].id`),
    path: assertString(value.path, `sections[${index}].path`),
    role: role as SectionRole,
    required: value.required,
    template: assertString(value.template, `sections[${index}].template`),
  };
}

function assertTemplate(value: unknown, index: number): TemplateDef {
  if (!isRecord(value)) {
    throw new Error(`templates[${index}] must be an object`);
  }

  return {
    id: assertString(value.id, `templates[${index}].id`),
    path: assertString(value.path, `templates[${index}].path`),
  };
}

function assertPolicies(value: unknown): Policies {
  if (value === undefined) {
    return { max_lines: 400, ignore: [] };
  }
  if (!isRecord(value)) {
    throw new Error("policies must be an object");
  }

  const policies = value;
  const maxLines =
    policies.max_lines === undefined ? 400 : policies.max_lines;
  if (typeof maxLines !== "number" || !Number.isFinite(maxLines)) {
    throw new Error("policies.max_lines must be a number");
  }

  const maxLineLength =
    policies.max_line_length === undefined ? undefined : policies.max_line_length;
  if (
    maxLineLength !== undefined &&
    (typeof maxLineLength !== "number" || !Number.isFinite(maxLineLength))
  ) {
    throw new Error("policies.max_line_length must be a number");
  }

  const ignore = policies.ignore === undefined ? [] : policies.ignore;
  if (!Array.isArray(ignore) || !ignore.every((item) => typeof item === "string")) {
    throw new Error("policies.ignore must be an array of strings");
  }

  return {
    max_lines: maxLines,
    max_line_length: maxLineLength,
    ignore,
  };
}

export function assertContractSchema(raw: unknown): Contract {
  if (!isRecord(raw)) {
    throw new Error("Contract must be a YAML object");
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      console.warn(`Unknown contract key "${key}" ignored`);
    }
  }

  const schemaVersion = raw.schema_version;
  if (schemaVersion !== DEFAULT_SCHEMA_VERSION) {
    const seen =
      schemaVersion === undefined ? "missing" : String(schemaVersion);
    throw new Error(
      `Unsupported schema_version ${seen}; this CLI (${PACKAGE_VERSION}) supports schema_version ${DEFAULT_SCHEMA_VERSION} only. See README Upgrade`,
    );
  }

  const cliCompat = assertString(raw.cli_compat, "cli_compat");
  const skillsStamp = assertString(raw.skills_stamp, "skills_stamp");

  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    throw new Error("sections must be a non-empty array");
  }
  const sections = raw.sections.map(assertSection);

  if (!Array.isArray(raw.templates) || raw.templates.length === 0) {
    throw new Error("templates must be a non-empty array");
  }
  const templates = raw.templates.map(assertTemplate);

  const policies = assertPolicies(raw.policies);

  return {
    schema_version: DEFAULT_SCHEMA_VERSION,
    cli_compat: cliCompat,
    skills_stamp: skillsStamp,
    sections,
    templates,
    policies,
  };
}
