#!/usr/bin/env node
// doc-canon CLI entry.
//
// node:sqlite (the code-index SQLite store) is Stability 1 (active
// development); Node prints a one-time ExperimentalWarning to stderr the first
// time it is imported. The CLI's static import graph pulls in the code-index
// modules on every invocation, so without a filter that warning would pollute
// the stderr of every `doc-canon` command. Suppress this specific, documented
// warning at the CLI entry. Library consumers (doc-canon/code-search,
// doc-canon/code-index-reader) are NOT filtered and still see it in their own
// processes.
const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarningFiltered(warning, ...args) {
  const message =
    typeof warning === "string"
      ? warning
      : warning instanceof Error
        ? warning.message
        : String(warning ?? "");
  if (message.includes("SQLite is an experimental feature")) return;
  originalEmitWarning.call(process, warning, ...args);
};
await import("../dist/cli.js");
