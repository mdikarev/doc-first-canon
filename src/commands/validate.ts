import { validateCanon as validateStructure } from "../validate/validate.js";

export async function validateCanon(root: string): Promise<number> {
  const result = validateStructure(root);
  for (const warning of result.issues.filter(
    (issue) => issue.severity === "warning",
  )) {
    console.warn(`warning: ${warning.message}`);
  }
  for (const error of result.issues.filter(
    (issue) => issue.severity === "error",
  )) {
    console.error(`error: ${error.message}`);
  }
  if (result.ok) console.log("Canon is valid.");
  return result.ok ? 0 : 1;
}
