import { Window } from 'happy-dom'

const dom = new Window({ url: 'http://localhost' })

for (const [key, value] of Object.entries({
  window: dom,
  document: dom.document,
  navigator: dom.navigator,
  localStorage: dom.localStorage,
  Element: dom.Element,
  HTMLElement: dom.HTMLElement,
  Node: dom.Node,
  MutationObserver: dom.MutationObserver,
  getComputedStyle: dom.getComputedStyle.bind(dom),
  requestAnimationFrame: dom.requestAnimationFrame.bind(dom),
  cancelAnimationFrame: dom.cancelAnimationFrame.bind(dom),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
