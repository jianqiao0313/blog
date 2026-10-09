import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function componentScript(file) {
  const source = readFileSync(
    new URL(`../src/components/${file}`, import.meta.url),
    "utf8"
  );
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, `${file} has a client script`);
  let code = ts.transpileModule(match[1].replace(/^\s*import [^\n]+;$/gm, ""), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return code.replaceAll(/import\(("[^"]+")\)/g, "load($1)");
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
}

function statsHarness({ idle = true } = {}) {
  const events = createEventTarget();
  const callbacks = new Map();
  const cancelledIdle = [];
  const clearedTimers = [];
  const requests = [];
  const aborted = [];
  let nextId = 1;
  let element = {
    dataset: { serverUrl: "https://waline.example.com" },
    isConnected: true,
  };
  const location = { pathname: "/posts/a" };
  const window = idle
    ? {
        requestIdleCallback(callback) {
          const id = nextId++;
          callbacks.set(id, callback);
          return id;
        },
        cancelIdleCallback(id) {
          cancelledIdle.push(id);
          callbacks.delete(id);
        },
      }
    : {};
  const context = vm.createContext({
    document: {
      ...events,
      querySelector: selector =>
        selector === ".waline-stats" ? element : null,
    },
    window,
    location,
    pageviewCount() {
      const path = location.pathname;
      requests.push(["pageview", path]);
      return () => aborted.push(["pageview", path]);
    },
    commentCount() {
      const path = location.pathname;
      requests.push(["comment", path]);
      return () => aborted.push(["comment", path]);
    },
    setTimeout(callback) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      clearedTimers.push(id);
      callbacks.delete(id);
    },
  });
  vm.runInContext(componentScript("WalineStats.astro"), context);
  return {
    requests,
    aborted,
    cancelledIdle,
    clearedTimers,
    pending: () => [...callbacks.entries()],
    run(id, { evenIfCancelled = false } = {}) {
      const callback = callbacks.get(id);
      if (!callback && !evenIfCancelled) return;
      callbacks.delete(id);
      (callback ?? this.cancelledCallback)?.();
    },
    capture(id) {
      this.cancelledCallback = callbacks.get(id);
    },
    navigate(path, { withStats = true } = {}) {
      element.isConnected = false;
      location.pathname = path;
      element = withStats
        ? {
            dataset: { serverUrl: "https://waline.example.com" },
            isConnected: true,
          }
        : null;
    },
    event: events.dispatch,
  };
}

test("WalineStats cancels idle work and stale callbacks cannot count the next page", () => {
  const h = statsHarness();
  const [[idleId]] = h.pending();
  h.capture(idleId);
  h.event("astro:before-swap");
  assert.deepEqual(h.cancelledIdle, [idleId]);

  h.navigate("/posts/b");
  h.event("astro:page-load");
  h.run(idleId, { evenIfCancelled: true });
  assert.deepEqual(h.requests, []);

  const [[nextId]] = h.pending();
  h.run(nextId);
  assert.deepEqual(h.requests, [
    ["pageview", "/posts/b"],
    ["comment", "/posts/b"],
  ]);
});

test("WalineStats clears timer work when leaving a page", () => {
  const h = statsHarness({ idle: false });
  const [[timerId]] = h.pending();
  h.event("astro:before-swap");
  assert.deepEqual(h.clearedTimers, [timerId]);
  h.navigate("/about", { withStats: false });
  h.event("astro:page-load");
  assert.deepEqual(h.requests, []);
});

test("WalineStats aborts active counter requests before navigation", () => {
  const h = statsHarness();
  const [[idleId]] = h.pending();
  h.run(idleId);
  h.event("astro:before-swap");
  assert.deepEqual(h.aborted, [
    ["pageview", "/posts/a"],
    ["comment", "/posts/a"],
  ]);
});

function makeElement(tagName = "div") {
  const listeners = new Map();
  return {
    tagName: tagName.toUpperCase(),
    dataset: {},
    children: [],
    isConnected: true,
    textContent: "",
    append(...children) {
      this.children.push(...children);
    },
    replaceChildren(...children) {
      this.children = children;
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    click() {
      listeners.get("click")?.();
    },
  };
}

function commentsHarness({
  observerAvailable = true,
  deferImport = false,
} = {}) {
  const events = createEventTarget();
  const observers = [];
  const initialized = [];
  const destroyed = [];
  const importResolvers = [];
  let failImport = false;
  let element = makeElement();
  element.id = "waline";
  element.dataset.serverUrl = "https://waline.example.com";
  element.dataset.path = "/thread-a";

  function init(options) {
    initialized.push(options);
    return { destroy: () => destroyed.push(options.el) };
  }

  const document = {
    ...events,
    documentElement: { lang: "zh-CN" },
    getElementById: id => (id === "waline" ? element : null),
    createElement: makeElement,
  };
  const context = vm.createContext({
    document,
    window: { location: { pathname: "/posts/a" } },
    IntersectionObserver: observerAvailable
      ? class {
          constructor(callback) {
            this.callback = callback;
            this.observed = [];
            observers.push(this);
          }
          observe(target) {
            this.observed.push(target);
          }
          disconnect() {
            this.observed = [];
          }
          trigger() {
            this.callback(
              this.observed.map(target => ({ target, isIntersecting: true }))
            );
          }
          deliver(target) {
            this.callback([{ target, isIntersecting: true }]);
          }
        }
      : undefined,
    load(specifier) {
      if (specifier.includes("style")) return Promise.resolve({});
      if (failImport) return Promise.reject(new Error("network failure"));
      if (!deferImport) return Promise.resolve({ init });
      return new Promise(resolve =>
        importResolvers.push(() => resolve({ init }))
      );
    },
  });
  vm.runInContext(componentScript("Comments.astro"), context);
  return {
    initialized,
    destroyed,
    observers,
    element: () => element,
    event: events.dispatch,
    resolveImport(index = 0) {
      importResolvers[index]?.();
    },
    setImportFailure(value) {
      failImport = value;
    },
    replaceElement() {
      element.isConnected = false;
      element = makeElement();
      element.id = "waline";
      element.dataset.serverUrl = "https://waline.example.com";
      element.dataset.path = "/thread-b";
      context.window.location.pathname = "/posts/b";
      return element;
    },
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("Comments ignores a delayed import from the previous page", async () => {
  const h = commentsHarness({ deferImport: true });
  const firstElement = h.element();
  h.observers[0].trigger();
  h.event("astro:before-swap");
  const secondElement = h.replaceElement();
  h.event("astro:page-load");
  h.observers.at(-1).trigger();

  h.resolveImport(0);
  await tick();
  assert.deepEqual(h.initialized, []);

  h.resolveImport(1);
  await tick();
  assert.equal(h.initialized.length, 1);
  assert.equal(h.initialized[0].el, secondElement);
  assert.notEqual(h.initialized[0].el, firstElement);
});

test("Comments ignores an old observer callback after the new page starts loading", async () => {
  const h = commentsHarness({ deferImport: true });
  const oldElement = h.element();
  const oldObserver = h.observers[0];
  h.event("astro:before-swap");
  const newElement = h.replaceElement();
  h.event("astro:page-load");
  h.observers.at(-1).trigger();

  oldObserver.deliver(oldElement);
  h.resolveImport(0);
  await tick();

  assert.equal(h.initialized.length, 1);
  assert.equal(h.initialized[0].el, newElement);
});

test("Comments shows a Chinese retry action after loading fails", async () => {
  const h = commentsHarness();
  h.setImportFailure(true);
  h.observers[0].trigger();
  await tick();

  const [message, retry] = h.element().children;
  assert.match(message.textContent, /评论加载失败/);
  assert.match(retry.textContent, /重试/);

  h.setImportFailure(false);
  retry.click();
  await tick();
  assert.equal(h.initialized.length, 1);
  assert.equal(h.initialized[0].el, h.element());
});

test("Comments initializes immediately without IntersectionObserver and destroys on swap", async () => {
  const h = commentsHarness({ observerAvailable: false });
  await tick();
  assert.equal(h.initialized.length, 1);
  assert.equal(h.initialized[0].el, h.element());

  h.event("astro:before-swap");
  assert.deepEqual(h.destroyed, [h.element()]);
});
