import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFresh } from "../src/agnostic/freshness.js";

describe("isFresh", () => {
  it("is true when paths and hashes match", () => {
    const manifest = { "a.ts": { hash: "h1" }, "b.ts": { hash: "h2" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h2" }), true);
  });

  it("is false when a hash differs", () => {
    const manifest = { "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h2" }), false);
  });

  it("is false when path sets differ", () => {
    const manifest = { "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h3" }), false);
    assert.equal(isFresh(manifest, {}), false);
  });

  it("ignores key insertion order (sorts internally)", () => {
    const manifest = { "b.ts": { hash: "h2" }, "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h2" }), true);
  });
});
