import { spawnSync } from "node:child_process";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function runPython(args) {
  const candidates = process.env.CONCORD_PYTHON
    ? [[process.env.CONCORD_PYTHON, []]]
    : [["python3", []], ["python", []], ["py", ["-3"]]];
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(command, [...prefix, "-c", "import sys; sys.exit(sys.version_info < (3, 11))"], { stdio: "ignore" });
    if (probe.error || probe.status !== 0) continue;
    const result = spawnSync(command, [...prefix, ...args], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        PYTHONPATH: [resolve(root, "backend"), process.env.PYTHONPATH].filter(Boolean).join(delimiter),
      },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Python exited with ${result.status ?? result.signal}`);
    return;
  }
  throw new Error("Python 3.11+ is required. Install it or set CONCORD_PYTHON to its executable path.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPython(process.argv.slice(2));
}
