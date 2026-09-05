process.on("uncaughtException", (error) => {
  console.error("WASM ERROR:", error.message);
  process.exit(1);
});
import { loadPyodide } from "pyodide";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const py = await loadPyodide();
py.unpackArchive(
  new Uint8Array(await readFile("public/python/concord.zip")),
  "zip",
  { extractDir: "/concord-app" },
);
py.runPython(
  "import sys\nsys.path.insert(0, '/concord-app')\nfrom concord.demo import dispatch",
);
function send(data) {
  py.globals.set("command_json", JSON.stringify(data));
  return JSON.parse(py.runPython("dispatch(command_json)"));
}
for (const kind of ["permission", "content", "deletion", "probe_failure"]) {
  send({ action: "reset" });
  const detected = send({
    action: "detect",
    source_id: "src-forecast",
    kind,
    identity: "alex",
    key: kind,
  });
  assert.equal(detected.snapshot.counts.blocked, 3);
  const id = detected.result.id;
  const repair = send({ action: "repair", event_id: id });
  assert.equal(repair.snapshot.counts.blocked, 3);
  const proof = send({ action: "verify", event_id: id });
  assert.equal(
    proof.result.result,
    kind === "probe_failure" ? "unverified" : "verified",
  );
  const probe = send({
    action: "probe",
    artifact_id: "memory-forecast",
    identity: "alex",
  });
  assert.equal(probe.result.allowed, kind === "content");
  console.log(
    `${kind}: ${proof.result.checks.filter((c) => c.passed).length}/${proof.result.checks.length} checks, expected outcome passed`,
  );
}
console.log("Python WASM parity: all four scenarios passed");
// Exercise the new automatic core in the same browser-compatible package.
py.runPython("from concord.runtime.browser_demo import dispatch");
const initial = send({action:"tick"});
assert.equal(initial.status.status,"current");
assert.equal(initial.status.metrics.verified_documents,2);
const original = initial.documents.find(d=>d.id==="api-limits");
const edited = send({action:"save_source",document:{...original,content:"Atlas API includes 417 requests per minute."}});
assert.equal(edited.status.documents.find(d=>d.id==="api-limits").revision,original.revision,"Source edit must not synchronously update index");
send({action:"tick"});
for(const route of ["support","success"]) {
  assert.match(send({action:"retrieve",query:"417",identity:"alex",route}).result.documents[0].content,/417/);
}
send({action:"save_source",document:{...edited.documents.find(d=>d.id==="api-limits"),acl:["jordan"]}});
send({action:"tick"});
assert.equal(send({action:"retrieve",query:"417",identity:"alex",route:"success"}).result.documents.length,0);
assert.equal(send({action:"retrieve",query:"417",identity:"jordan",route:"success"}).result.documents.length,1);
send({action:"availability",available:false});send({action:"tick"});
assert.equal(send({action:"retrieve",query:"API",identity:"jordan"}).result.status,"blocked");
send({action:"restore_source"});send({action:"tick"});
assert.equal(send({action:"status"}).status.status,"current");
console.log("Automatic WASM: separate source edit, update, direct/cached retrieval, revocation, outage and recovery passed");
