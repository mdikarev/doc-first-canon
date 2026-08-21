import { validateCanon as validateStructure } from "../validate/validate.js";

export async function validateCanon(
  root: string,
  opts: { json?: boolean } = {},
): Promise<number> {
  const result = validateStructure(root);
  if (opts.json) {
    console.log(
      JSON.stringify({ schema_version: 1, ok: result.ok, issues: result.issues }, null, 2),
    );
    return result.ok ? 0 : 1;
  }
  for (const warning of result.issues.filter((i) => i.severity === "warning")) {
    console.warn(`warning: ${warning.message}`);
  }
  for (const error of result.issues.filter((i) => i.severity === "error")) {
    console.error(`error: ${error.message}`);
  }
  if (result.ok) console.log("Canon is valid.");
  return result.ok ? 0 : 1;
}
