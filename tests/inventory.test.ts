import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { buildInventory, writeInventory } from "../src/inventory/build.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const fixture = join(testsDir, "fixtures", "ignore-globs");

describe("buildInventory", () => {
  it("lists repo-relative entries while applying default and custom ignores", () => {
    const inventory = buildInventory(fixture, ["tmp/**"]);
    const paths = inventory.entries.map((entry) => entry.path);

    assert.equal(inventory.root, fixture);
    assert.match(inventory.generated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(paths.includes("src"));
    assert.ok(paths.includes("src/foo.ts"));
    assert.ok(!paths.some((entryPath) => entryPath.startsWith("node_modules")));
    assert.ok(!paths.some((entryPath) => entryPath.startsWith("tmp")));
    assert.deepEqual(
      inventory.entries.find((entry) => entry.path === "src/foo.ts"),
      {
        path: "src/foo.ts",
        kind: "file",
        basename: "foo.ts",
        tokens: ["foo", "ts"],
      },
    );
  });

  it("records case-insensitive glossary hits in text files", () => {
    const inventory = buildInventory(fixture, ["tmp/**"], ["glossary widget", "absent"]);

    assert.deepEqual(inventory.text_hits, [
      { term: "glossary widget", paths: ["src/foo.ts"] },
      { term: "absent", paths: [] },
    ]);
  });
});

describe("writeInventory", () => {
  it("writes formatted JSON under .doc-canon", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-inventory-"));
    try {
      cpSync(fixture, root, { recursive: true });
      const inventory = buildInventory(root, ["tmp/**"]);

      writeInventory(root, inventory);

      assert.deepEqual(
        JSON.parse(readFileSync(join(root, ".doc-canon", "inventory.json"), "utf8")),
        inventory,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
