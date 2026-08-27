import { writeFile } from "node:fs/promises";

const [url, widthText, heightText, output, selector = "", reduced = "false", delayText = "2200"] = process.argv.slice(2);
const width = Number(widthText);
const height = Number(heightText);
const delay = Number(delayText);

if (!url || !width || !height || !output) {
  throw new Error("Usage: node scripts/capture-responsive.mjs <url> <width> <height> <output> [selector] [reduced]");
}

const target = await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(url)}`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener("message", (message) => {
  const payload = JSON.parse(String(message.data));
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

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 820 });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced === "true" ? "reduce" : "no-preference" }] });
await send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, Number.isFinite(delay) ? delay : 2200));

if (selector) {
  await send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start',behavior:'instant'})` });
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const metrics = await send("Runtime.evaluate", {
  returnByValue: true,
  expression: `(() => { const hero=document.querySelector('.cc-hero-copy'); const brand=document.querySelector('.cc-header .cc-brand-mark strong'); const fauna=[...document.querySelectorAll('.cc-fauna')].map((node)=>({className:node.className,rect:node.getBoundingClientRect().toJSON(),display:getComputedStyle(node).display,opacity:getComputedStyle(node).opacity,transform:getComputedStyle(node).transform})); return {innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,activeElement:document.activeElement?.tagName,heroOpacity:hero?getComputedStyle(hero).opacity:null,heroAnimation:hero?getComputedStyle(hero).animationName:null,brandText:brand?.getBoundingClientRect().toJSON(),brandColor:brand?getComputedStyle(brand).color:null,fauna}; })()`,
});
const screenshot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
await writeFile(output, Buffer.from(screenshot.data, "base64"));
process.stdout.write(`${JSON.stringify(metrics.result.value)}\n`);
socket.close();
