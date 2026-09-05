import { mkdir, copyFile } from "node:fs/promises";
import { runPython } from "./run-python.mjs";
await mkdir("public/py-runtime", { recursive: true });
for (const name of [
  "pyodide.mjs",
  "pyodide.asm.mjs",
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide-lock.json",
])
  await copyFile(`node_modules/pyodide/${name}`, `public/py-runtime/${name}`);
await copyFile(
  "node_modules/pyodide/package.json",
  "public/py-runtime/package.json",
);
runPython(["scripts/package-python.py"]);
