// Debe importarse ANTES de react-dom: react-dom decide si hay DOM al cargarse.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><div id=r></div>", { url: "https://x.test/", pretendToBeVisual: true });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, localStorage: w.localStorage, HTMLElement: w.HTMLElement, matchMedia: () => ({ matches: false }) });
w.matchMedia = globalThis.matchMedia;
Object.defineProperty(w.HTMLElement.prototype, "clientHeight", { configurable: true, get() { return 420; } });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = w.requestAnimationFrame.bind(w);
globalThis.cancelAnimationFrame = w.cancelAnimationFrame.bind(w);
