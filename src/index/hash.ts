import { createHash } from "node:crypto";

export function contentHash(content: string): string {
  const hex = createHash("sha256").update(content, "utf8").digest("hex");
  return `sha256:${hex}`;
}
