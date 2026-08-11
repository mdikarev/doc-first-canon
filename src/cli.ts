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
  .option("--yes", "accept non-interactive defaults")
  .action(
    async (opts: {
      root: string;
      forceSkills?: boolean;
      yes?: boolean;
    }) => {
      const { initCanon } = await import("./commands/init.js");
      process.exitCode = await initCanon(opts.root, opts);
    },
  );
program
  .command("upgrade-skills")
  .description("Refresh managed skills/rules/AGENTS block")
  .option("--root <path>", "target repo root", ".")
  .action(async (opts: { root: string }) => {
    try {
      const { upgradeSkills } = await import("./commands/upgrade-skills.js");
      process.exitCode = await upgradeSkills(opts.root);
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
  .action(async (opts: { root: string }) => {
    const { validateCanon } = await import("./commands/validate.js");
    process.exitCode = await validateCanon(opts.root);
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

await program.parseAsync();
