#!/usr/bin/env node
import { Command } from "commander";
import { PACKAGE_VERSION } from "./version.js";

const program = new Command();
program
  .name("doc-canon")
  .description("Deterministic canon CLI for agent documentation")
  .version(PACKAGE_VERSION);

program.command("init").description("Scaffold canon + managed agent assets");
program.command("upgrade-skills").description("Refresh managed skills/rules/AGENTS block");
program.command("validate").description("Schema + structure validation");
program.command("check").description("Validate + inventory + structural report");
program.command("report").description("Print last report.json");

program.parse();
