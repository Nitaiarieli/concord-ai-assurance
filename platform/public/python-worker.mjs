import { loadPyodide } from "./py-runtime/pyodide.mjs";
let runtime;
async function initialize() {
  const py = await loadPyodide({
    indexURL: new URL("./py-runtime/", import.meta.url).href,
  });
  const response = await fetch(
    new URL("./python/concord.zip", import.meta.url),
  );
  if (!response.ok)
    throw new Error(
      "The Python engine could not be loaded. Reload to try again.",
    );
  py.unpackArchive(await response.arrayBuffer(), "zip", {
    extractDir: "/concord-app",
  });
  py.runPython(
    "import sys\nsys.path.insert(0, '/concord-app')\nfrom concord.demo import dispatch",
  );
  return py;
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      runtime ??= initialize();
      const py = await runtime;
      py.globals.set("command_json", JSON.stringify(data.payload));
      const result = py.runPython("dispatch(command_json)");
      self.postMessage({ id: data.id, data: JSON.parse(result) });
    } catch (error) {
      self.postMessage({
        id: data.id,
        error: error.message || "Command failed",
      });
    }
  });
};
