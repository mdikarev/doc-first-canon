import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(path.join(root, "scripts", "release.sh"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts?: { release?: string };
};

describe("release.sh", () => {
  it("is wired as npm run release, tags after publish, and never uses GitHub Actions", () => {
    assert.equal(pkg.scripts?.release, "bash scripts/release.sh");
    assert.match(script, /npm test/);
    assert.match(script, /npm run build/);
    assert.match(script, /doc-canon validate|bin\/doc-canon\.js validate/);
    assert.match(script, /npm pack --dry-run/);
    assert.match(script, /LICENSE/);
    assert.match(script, /CHANGELOG\.md/);
    assert.match(script, /README\.md/);
    assert.match(script, /npm publish/);
    assert.match(script, /DRY_RUN|--dry-run/);
    assert.match(script, /git tag/);
    assert.match(script, /git push/);
    assert.doesNotMatch(script, /\.github/);
    // The tag step runs only after a real publish (dry-run exits before it), so
    // every successful release always produces a v<version> tag.
    const publishAt = script.indexOf("npm publish");
    const tagAt = script.indexOf("git tag");
    assert.ok(publishAt !== -1 && tagAt > publishAt, "git tag must appear after npm publish");
    assert.match(script, /dry-run: skip npm publish/);
  });
});
