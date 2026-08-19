// src/commands/discipline.ts
import { resolveRoot } from "../paths.js";
import {
  computeDisciplineState,
  type KindState,
} from "../discipline/state.js";

function describeKind(label: string, s: KindState): string {
  if (!s.indexExists) return `${label}: no index (not-applicable)`;
  const probe =
    s.lastProbe === null
      ? "never probed"
      : `last probe ${s.lastProbe.ts}`;
  return `${label}: ${s.changed.length} file(s) changed; ${probe}; un-probed: ${s.unprobed}`;
}

export async function disciplineReport(
  rootFlag: string,
  opts: { json?: boolean },
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const state = computeDisciplineState(root);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          doc: {
            index_exists: state.doc.indexExists,
            changed: state.doc.changed.length,
            last_probe: state.doc.lastProbe?.ts ?? null,
            unprobed: state.doc.unprobed,
          },
          code: {
            index_exists: state.code.indexExists,
            changed: state.code.changed.length,
            last_probe: state.code.lastProbe?.ts ?? null,
            unprobed: state.code.unprobed,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.log(describeKind("doc", state.doc));
    console.log(describeKind("code", state.code));
  }
  return state.doc.unprobed || state.code.unprobed ? 1 : 0;
}
