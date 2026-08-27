const target = await fetch("http://127.0.0.1:9222/json/new?http://127.0.0.1:4181/", { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const runtimeErrors = [];
socket.addEventListener("message", (message) => {
  const payload = JSON.parse(String(message.data));
  if (payload.method === "Runtime.exceptionThrown") runtimeErrors.push(payload.params.exceptionDetails.text);
  if (payload.method === "Runtime.consoleAPICalled" && payload.params.type === "error") runtimeErrors.push("console.error");
  if (!payload.id || !pending.has(payload.id)) return;
  const { resolve, reject } = pending.get(payload.id);
  pending.delete(payload.id);
  if (payload.error) reject(new Error(payload.error.message));
  else resolve(payload.result);
});

function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
}

const pause = (duration = 120) => new Promise((resolve) => setTimeout(resolve, duration));
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "http://127.0.0.1:4181/" });
await pause(2200);

const structure = await evaluate(`(() => ({
  title: document.querySelector('h1')?.textContent.trim(),
  h1Count: document.querySelectorAll('h1').length,
  h2Count: document.querySelectorAll('h2').length,
  stageCount: document.querySelectorAll('.cc-stage-rail [role="tab"]').length,
  rootPathCount: document.querySelectorAll('.cc-lineage-system > svg path').length,
  faunaCount: document.querySelectorAll('.cc-fauna').length,
  activeStage: document.querySelector('.cc-stage-rail [aria-selected="true"]')?.textContent.trim(),
  routes: [...new Set([...document.querySelectorAll('.cc-site a[href^="/"]')].map((link) => link.getAttribute('href')))].sort(),
  overflow: document.documentElement.scrollWidth <= innerWidth,
  touchTargets: [...document.querySelectorAll('.cc-hero-actions a,.cc-hero-actions button,.cc-stage-rail button')].every((node) => node.getBoundingClientRect().height >= 43)
}))()`);

await evaluate(`document.querySelector('.cc-stage-rail [role="tab"]')?.focus()`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight" });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight" });
await pause(650);
const keyboardStage = await evaluate(`document.querySelector('.cc-stage-rail [aria-selected="true"]')?.textContent.trim()`);

await evaluate(`document.querySelector('.cc-object-strip button')?.click()`);
await pause(180);
const inspectorOpen = await evaluate(`(() => { const layer=document.querySelector('.cc-inspector-layer'); return { hidden: layer.hidden, role: document.querySelector('.cc-inspector')?.getAttribute('role'), focus: document.activeElement?.getAttribute('aria-label'), tabs:[...document.querySelectorAll('.cc-detail-tabs button')].map((button)=>button.textContent.trim()) }; })()`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
await pause(180);
const inspectorClosed = await evaluate(`(() => { const layer=document.querySelector('.cc-inspector-layer'); return { hidden: !layer || layer.hidden, focusReturned: document.activeElement === document.querySelector('.cc-object-strip button') }; })()`);

await evaluate(`document.querySelector('.cc-hero-actions button')?.click()`);
await pause(180);
const contactOpen = await evaluate(`(() => ({ open: Boolean(document.querySelector('[role="dialog"].contact-dialog')), focus: document.activeElement?.getAttribute('aria-label') }))()`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
await pause(180);
const contactClosed = await evaluate(`!document.querySelector('[role="dialog"].contact-dialog')`);

const evidenceFilter = await evaluate(`(() => { const button=[...document.querySelectorAll('.cc-evidence-filters button')].find((node)=>node.textContent.trim()==='Proof'); button.click(); return new Promise((resolve)=>setTimeout(()=>resolve({pressed:button.getAttribute('aria-pressed'),rows:document.querySelectorAll('.cc-evidence-list > button').length}),80)); })()`);

const widths = {};
for (const width of [1440, 1024, 768, 390, 360]) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 820 });
  await pause(80);
  widths[width] = await evaluate(`({innerWidth,scrollWidth:document.documentElement.scrollWidth,ok:document.documentElement.scrollWidth<=innerWidth})`);
}

const mobileMenu = await evaluate(`(() => { const menu=document.querySelector('.cc-mobile-menu'); menu.open=true; const panel=menu.querySelector('div').getBoundingClientRect(); return {open:menu.open,links:menu.querySelectorAll('a').length,touchTarget:menu.querySelector('summary').getBoundingClientRect().height>=40,withinViewport:panel.left>=0&&panel.right<=innerWidth}; })()`);

await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`scrollTo({top:document.documentElement.scrollHeight*.45,behavior:'instant'})`);
await pause(180);
const ecosystemMotion = await evaluate(`(() => { const site=document.querySelector('.cc-site'); const fauna=document.querySelector('.cc-fauna-gecko'); return {rootProgress:Number.parseFloat(getComputedStyle(site).getPropertyValue('--cc-root-progress')),scrollShift:Number.parseFloat(getComputedStyle(site).getPropertyValue('--cc-scroll-shift')),faunaTransform:getComputedStyle(fauna).transform}; })()`);

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await pause(80);
const reducedMotion = await evaluate(`(() => ({scrollBehavior:getComputedStyle(document.documentElement).scrollBehavior,stageAnimation:getComputedStyle(document.querySelector('.cc-stage-panel')).animationDuration,transition:getComputedStyle(document.querySelector('.cc-stage-rail button')).transitionDuration,rootOffset:getComputedStyle(document.querySelector('.cc-root-main')).strokeDashoffset,faunaTransform:getComputedStyle(document.querySelector('.cc-fauna-gecko')).transform}))()`);

const report = { structure, keyboardStage, inspectorOpen, inspectorClosed, contactOpen, contactClosed, evidenceFilter, widths, mobileMenu, ecosystemMotion, reducedMotion, runtimeErrors };
const passed = structure.h1Count === 1
  && structure.h2Count >= 5
  && structure.stageCount === 5
  && structure.rootPathCount >= 7
  && structure.faunaCount === 3
  && structure.overflow
  && structure.touchTargets
  && /Trace/.test(keyboardStage)
  && inspectorOpen.hidden === false
  && inspectorOpen.role === "dialog"
  && inspectorOpen.focus === "Close object details"
  && inspectorOpen.tabs.join(",") === "Risk,Action,Proof"
  && inspectorClosed.hidden
  && inspectorClosed.focusReturned
  && contactOpen.open
  && contactOpen.focus === "Close contact window"
  && contactClosed
  && evidenceFilter.pressed === "true"
  && evidenceFilter.rows === 2
  && Object.values(widths).every((item) => item.ok)
  && mobileMenu.open
  && mobileMenu.links >= 9
  && mobileMenu.touchTarget
  && mobileMenu.withinViewport
  && ecosystemMotion.rootProgress > .4
  && ecosystemMotion.scrollShift > .3
  && ecosystemMotion.faunaTransform !== "none"
  && reducedMotion.scrollBehavior === "auto"
  && reducedMotion.rootOffset === "0px"
  && reducedMotion.faunaTransform === "none"
  && runtimeErrors.length === 0;

process.stdout.write(`${JSON.stringify({ passed, ...report }, null, 2)}\n`);
socket.close();
if (!passed) process.exitCode = 1;
