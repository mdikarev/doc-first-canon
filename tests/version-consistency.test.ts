// tests/version-consistency.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PACKAGE_VERSION } from "../src/version.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { version: string };

describe("version consistency", () => {
  it("keeps package.json version in sync with src/version.ts PACKAGE_VERSION", () => {
    assert.equal(pkg.version, PACKAGE_VERSION);
  });
});
