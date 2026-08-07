import { validateCanon as validateStructure } from "../validate/validate.js";

export async function validateCanon(root: string): Promise<number> {
  const result = validateStructure(root);
  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }
  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }
  if (result.ok) console.log("Canon is valid.");
  return result.ok ? 0 : 1;
}
