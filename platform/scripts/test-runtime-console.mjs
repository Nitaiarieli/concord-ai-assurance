// Regression for the actual HTTP status envelope consumed by the local console.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const payload = JSON.parse(
  execFileSync(
    process.execPath,
    [
      "scripts/run-python.mjs",
      "-c",
      `
import json, secrets, tempfile, urllib.request
from pathlib import Path
from concord.runtime.models import SourceDocument, Snapshot
from concord.runtime.core import SyncRuntime
from concord.runtime.server import AccessPolicy, ConsumerCredential, RuntimeService
class Source:
 def scan(self): return Snapshot([SourceDocument('contract-doc','Console contract','Fresh API knowledge','v1',['alex'])])
with tempfile.TemporaryDirectory() as folder:
 token=secrets.token_urlsafe(32)
 policy=AccessPolicy(token, (ConsumerCredential(secrets.token_urlsafe(32),'alex','support'),))
 runtime=SyncRuntime(str(Path(folder)/'state.sqlite3'),Source())
 runtime.tick()
 service=RuntimeService(runtime,policy,port=0,poll_interval=2)
 service.start()
 try:
  request=urllib.request.Request(service.url+'/v1/status',headers={'Authorization':'Bearer '+token})
  print(urllib.request.urlopen(request,timeout=3).read().decode())
 finally: service.stop()
`,
    ],
    { encoding: "utf8" },
  ),
);
class Element {
  textContent = "";
  value = "";
  children = [];
  listeners = {};
  classList = { toggle() {} };
  replaceChildren(...children) {
    this.children = children;
  }
  append(child) {
    this.children.push(child);
  }
  addEventListener(name, handler) {
    this.listeners[name] = handler;
  }
}
const elements = new Map();
const get = (id) => {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
};
let fail = false;
const context = vm.createContext({
  document: { getElementById: get, createElement: () => new Element() },
  window: { addEventListener() {} },
  AbortController,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  fetch: async () => {
    if (fail) throw new Error("network unavailable");
    return { ok: true, json: async () => payload };
  },
});
const html = readFileSync("backend/concord/runtime/console.html", "utf8");
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
await vm.runInContext(
  "operatorToken='local-test-only'; updateStatus()",
  context,
);
assert.equal(get("status-label").textContent, "Sync state: current");
assert.equal(get("summary").children.length, 3);
assert.equal(get("documents").children[0].textContent, "Console contract");
fail = true;
await vm.runInContext("updateStatus()", context);
assert.match(get("status-label").textContent, /unavailable/);
assert.equal(get("summary").children.length, 0);
assert.equal(get("documents").children.length, 0);
console.log(
  "Local console: real HTTP envelope renders status/documents; network failure clears historical cards",
);
