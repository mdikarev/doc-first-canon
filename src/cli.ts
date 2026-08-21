#!/usr/bin/env node
import { Command } from "commander";
import { PACKAGE_VERSION } from "./version.js";

const program = new Command();
program
  .name("doc-canon")
  .description("Deterministic canon CLI for agent documentation")
  .version(PACKAGE_VERSION);

program
  .command("init")
  .description("Scaffold canon + managed agent assets")
  .option("--root <path>", "target repo root", ".")
  .option("--force-skills", "refresh managed agent assets on re-init")
  .option("--harnesses <cursor,claude,dsh>", "agent harnesses to install (comma-separated)")
  .option("--yes", "accept non-interactive defaults")
  .action(
    async (opts: {
      root: string;
      forceSkills?: boolean;
      yes?: boolean;
      harnesses?: string;
    }) => {
      try {
        const { initCanon } = await import("./commands/init.js");
        process.exitCode = await initCanon(opts.root, opts);
      } catch (error) {
        console.error(
          `error: ${error instanceof Error ? error.message : String(error)}`,
        );
        process.exitCode = 1;
      }
    },
  );
program
  .command("upgrade-skills")
  .description("Refresh managed skills/rules/AGENTS block")
  .option("--root <path>", "target repo root", ".")
  .option("--harnesses <cursor,claude,dsh>", "agent harnesses to refresh (comma-separated)")
  .option("--yes", "accept non-interactive defaults")
  .action(async (opts: { root: string; yes?: boolean; harnesses?: string }) => {
    try {
      const { upgradeSkills } = await import("./commands/upgrade-skills.js");
      process.exitCode = await upgradeSkills(opts.root, opts);
    } catch (error) {
      console.error(
        `error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  });
program
  .command("migrate")
  .description(
    "Bring an existing canon up to this CLI (required gaps, then upgrade-skills)",
  )
  .option("--root <path>", "target repo root", ".")
  .option("--harnesses <cursor,claude,dsh>", "agent harnesses to install (comma-separated)")
  .option("--yes", "accept non-interactive defaults")
  .action(async (opts: { root: string; yes?: boolean; harnesses?: string }) => {
    try {
      const { migrateCanon } = await import("./commands/migrate.js");
      process.exitCode = await migrateCanon(opts.root, opts);
    } catch (error) {
      console.error(
        `error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  });
program
  .command("validate")
  .description("Schema + structure validation")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit structured issues JSON on stdout")
  .action(async (opts: { root: string; json?: boolean }) => {
    const { validateCanon } = await import("./commands/validate.js");
    process.exitCode = await validateCanon(opts.root, { json: opts.json });
  });
program
  .command("check")
  .description("Validate + inventory + structural report")
  .option("--root <path>", "target repo root", ".")
  .action(async (opts: { root: string }) => {
    const { checkCanon } = await import("./commands/check.js");
    process.exitCode = await checkCanon(opts.root);
  });
program
  .command("report")
  .description("Print last report.json")
  .option("--root <path>", "target repo root", ".")
  .action(async (opts: { root: string }) => {
    const { printReport } = await import("./commands/report.js");
    process.exitCode = printReport(opts.root);
  });
program
  .command("index")
  .description("Build or refresh local BM25 index for docs/canon")
  .option("--root <path>", "target repo root", ".")
  .option("--watch", "poll and refresh index")
  .option("--stop", "stop a running --watch process")
  .option("--interval <ms>", "poll interval for --watch")
  .action(
    async (opts: {
      root: string;
      watch?: boolean;
      stop?: boolean;
      interval?: string;
    }) => {
      const { indexCanon } = await import("./commands/index-cmd.js");
      process.exitCode = await indexCanon(opts.root, opts);
    },
  );
program
  .command("search")
  .description("Search canon BM25 index and emit a bounded context pack")
  .argument("<query>", "search query")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit Pack JSON on stdout")
  .option("--max-hits <n>", "max ranked documents", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .action(
    async (
      query: string,
      opts: {
        root: string;
        json?: boolean;
        maxHits?: string;
        snippetLines?: string;
      },
    ) => {
      const { searchCanonCli } = await import("./commands/search.js");
      process.exitCode = await searchCanonCli(opts.root, query, opts);
    },
  );
program
  .command("scout")
  .description("Emit a generated working-set manifest (docs + optional code) for a topic")
  .argument("<query>", "topic query")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit ScoutManifest JSON on stdout")
  .option("--max-hits <n>", "max ranked documents", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .option("--no-code", "skip the code-index probe")
  .action(
    async (
      query: string,
      opts: {
        root: string;
        json?: boolean;
        maxHits?: string;
        snippetLines?: string;
        noCode?: boolean;
      },
    ) => {
      const { scoutCanonCli } = await import("./commands/scout.js");
      process.exitCode = await scoutCanonCli(opts.root, query, opts);
    },
  );
program
  .command("discipline")
  .description("Report probe discipline; exit ≠0 when the index is un-probed or corrupt")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit JSON on stdout")
  .action(async (opts: { root: string; json?: boolean }) => {
    const { disciplineReport } = await import("./commands/discipline.js");
    process.exitCode = await disciplineReport(opts.root, opts);
  });

const codeIndex = program
  .command("code-index")
  .description("Build a deterministic AST index over discovered source roots");

codeIndex
  .command("build")
  .description("Build or refresh the code AST index")
  .option("--root <path>", "target repo root", ".")
  .option("--watch", "poll and refresh index")
  .option("--stop", "stop a running --watch process")
  .option("--interval <ms>", "poll interval for --watch")
  .action(
    async (opts: {
      root: string;
      watch?: boolean;
      stop?: boolean;
      interval?: string;
    }) => {
      const { codeIndexBuild } = await import("./commands/code-index-cmd.js");
      process.exitCode = await codeIndexBuild(opts.root, opts);
    },
  );

codeIndex
  .command("search")
  .description("Search the code AST index and emit a bounded code pack")
  .argument("[query]", "symbol name query (omit with --refs)")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit CodePack JSON on stdout")
  .option("--max-hits <n>", "max hits", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .option("--kind <type>", "filter symbols by SymbolKind")
  .option("--file <glob>", "filter by file glob (micromatch)")
  .option("--refs <name>", "reference mode: syntactic references to name")
  .option("--body", "show the full declaration body to endLine")
  .action(
    async (
      query: string | undefined,
      opts: {
        root: string;
        json?: boolean;
        maxHits?: string;
        snippetLines?: string;
        kind?: string;
        file?: string;
        refs?: string;
        body?: boolean;
      },
    ) => {
      const { codeIndexSearch } = await import("./commands/code-index-search-cmd.js");
      process.exitCode = await codeIndexSearch(opts.root, query, opts);
    },
  );

await program.parseAsync();
