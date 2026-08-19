import { createInterface } from "node:readline";

export interface CheckboxOption<T extends string> {
  value: T;
  label: string;
  checked: boolean;
}

export function isTty(): boolean {
  return Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY);
}

/**
 * Multi-select checkbox prompt over a TTY (raw mode, no new dependencies).
 * Arrow keys move, space toggles, enter confirms; ctrl+c aborts with the
 * current selection and exit code 130. Callers gate with isTty() first.
 */
export async function checkboxPrompt<T extends string>(
  question: string,
  options: CheckboxOption<T>[],
): Promise<T[]> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  let selected: T[] = options.filter((option) => option.checked).map((o) => o.value);
  try {
    stdin.setRawMode(true);
    stdin.resume();
  } catch {
    // Non-TTY fallback: return the defaults without prompting.
    return selected;
  }

  const state = options.map((option) => option.checked);
  let cursor = 0;

  const render = (): void => {
    stdout.write(`${question}\n`);
    for (let i = 0; i < options.length; i += 1) {
      const pointer = i === cursor ? ">" : " ";
      const mark = state[i] ? "[x]" : "[ ]";
      stdout.write(`${pointer} ${mark} ${options[i].label}\n`);
    }
    stdout.write("(arrows: move · space: toggle · enter: confirm)\n");
  };

  const erase = (): void => {
    stdout.write(`\x1B[${options.length + 2}A\x1B[J`);
  };

  let resolveSelection: (value: void) => void = () => {};
  const selectionPromise = new Promise<void>((resolve) => {
    resolveSelection = resolve;
  });

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  let finished = false;

  const finish = (): void => {
    if (finished) return;
    finished = true;
    stdin.removeListener("keypress", onKeypress);
    rl.close();
    try {
      stdin.setRawMode(false);
    } catch {
      // stream may already be closing
    }
    erase();
    resolveSelection();
  };

  const onKeypress = (
    _str: string | undefined,
    key: { name?: string; ctrl?: boolean },
  ): void => {
    if (key.name === "up") {
      cursor = (cursor - 1 + options.length) % options.length;
    } else if (key.name === "down") {
      cursor = (cursor + 1) % options.length;
    } else if (key.name === "space") {
      state[cursor] = !state[cursor];
    } else if (key.name === "return" || key.name === "enter") {
      selected = options.filter((_, i) => state[i]).map((option) => option.value);
      finish();
      return;
    } else if (key.ctrl && key.name === "c") {
      selected = options.filter((_, i) => state[i]).map((option) => option.value);
      process.exitCode = 130;
      finish();
      return;
    }
    erase();
    render();
  };

  stdin.on("keypress", onKeypress);
  render();
  await selectionPromise;
  return selected;
}
