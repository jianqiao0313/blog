import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const components = [
  {
    file: "MediaPlayer.astro",
    selector: ".plyr-mount",
    imports: ["plyr", "plyr/dist/plyr.css"],
    elementSelector: ".plyr-media",
  },
  {
    file: "AudioPlayer.astro",
    selector: ".aplayer-mount",
    imports: ["aplayer", "aplayer/dist/APlayer.min.css"],
  },
];

function loadScript(file) {
  const source = readFileSync(
    new URL(`../src/components/${file}`, import.meta.url),
    "utf8"
  );
  const match = source.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, `${file} has a client script`);
  return match[1];
}

function makeHarness(
  component,
  {
    deferImport = false,
    failImport = false,
    observerAvailable = true,
    fixed = false,
  } = {}
) {
  const script = loadScript(component.file);
  const imports = [];
  const constructed = [];
  const destroyed = [];
  const errors = [];
  const observers = [];
  const listeners = new Map();
  let importFails = failImport;
  const mount = {
    dataset: {
      qualityOptions: "[1080,720]",
      qualityDefault: "720",
      audio: "[]",
      options: JSON.stringify({ fixed }),
    },
    isConnected: true,
    querySelector: () => media,
  };
  const media = { dataset: {}, isConnected: true, closest: () => mount };
  let mounts = [mount];
  let resolveImport;
  let rejectImport;
  const deferred = deferImport
    ? new Promise((resolve, reject) => {
        resolveImport = resolve;
        rejectImport = reject;
      })
    : null;
  function Player(target, options) {
    constructed.push({ target, options });
    this.destroy = () => destroyed.push(target);
  }
  const document = {
    documentElement: {},
    querySelectorAll: selector => {
      if (selector === component.selector) return mounts;
      if (selector === `${component.selector} ${component.elementSelector}`)
        return mounts.map(() => media);
      return [];
    },
    addEventListener: (name, fn) => {
      const handlers = listeners.get(name) ?? [];
      handlers.push(fn);
      listeners.set(name, handlers);
    },
  };
  const context = {
    document,
    Plyr: Player,
    APlayer: Player,
    reportError: error => errors.push(error),
    getComputedStyle: () => ({ getPropertyValue: () => "#abc" }),
    IntersectionObserver: observerAvailable
      ? class {
          observed = [];
          constructor(callback) {
            this.callback = callback;
            observers.push(this);
          }
          observe(element) {
            this.observed.push(element);
          }
          disconnect() {
            this.observed = [];
          }
          trigger() {
            this.callback(
              this.observed.map(target => ({ target, isIntersecting: true }))
            );
          }
        }
      : undefined,
    load: specifier => {
      imports.push(specifier);
      if (importFails) return Promise.reject(new Error("network failure"));
      if (deferred) return deferred.then(() => ({ default: Player }));
      return Promise.resolve({ default: Player });
    },
  };
  let js = ts.transpileModule(script.replace(/^\s*import [^\n]+;$/gm, ""), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  js = js.replaceAll(/import\(("[^"]+")\)/g, "load($1)");
  vm.runInNewContext(js, context);
  return {
    imports,
    constructed,
    destroyed,
    errors,
    observers,
    mount,
    event(name) {
      for (const fn of listeners.get(name) ?? []) fn();
    },
    resolveImport() {
      resolveImport?.();
    },
    rejectImport() {
      rejectImport?.(new Error("late network failure"));
    },
    setImportFailure(value) {
      importFails = value;
    },
    replaceMount() {
      mount.isConnected = false;
      media.isConnected = false;
      mounts = [];
    },
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

for (const component of components) {
  test(`${component.file}: loads near viewport once, then destroys before swap`, async () => {
    const h = makeHarness(component);
    assert.deepEqual(h.imports, []);
    assert.equal(h.observers.length, 1);
    assert.deepEqual(h.observers[0].observed, [h.mount]);
    h.observers[0].trigger();
    h.observers[0].trigger();
    h.event("astro:page-load");
    await tick();
    assert.deepEqual(h.imports, component.imports);
    assert.equal(h.constructed.length, 1);
    h.event("astro:before-swap");
    assert.equal(h.destroyed.length, 1);
  });

  test(`${component.file}: ignores imports completed after navigation`, async () => {
    const h = makeHarness(component, { deferImport: true });
    h.observers[0].trigger();
    h.event("astro:before-swap");
    h.replaceMount();
    h.resolveImport();
    await tick();
    assert.equal(h.constructed.length, 0);
  });

  test(`${component.file}: does not report a failed import after navigation`, async () => {
    const h = makeHarness(component, { deferImport: true });
    h.observers[0].trigger();
    h.event("astro:before-swap");
    h.replaceMount();
    h.rejectImport();
    await tick();
    assert.equal(h.errors.length, 0);
  });

  test(`${component.file}: falls back without IntersectionObserver`, async () => {
    const h = makeHarness(component, { observerAvailable: false });
    await tick();
    assert.equal(h.constructed.length, 1);
  });
}

test("AudioPlayer.astro: fixed player loads without waiting for an intersection", async () => {
  const h = makeHarness(components[1], { fixed: true });
  await tick();
  assert.equal(h.constructed.length, 1);
});

test("AudioPlayer.astro: failed enhancement leaves a native audio control", async () => {
  const source = readFileSync(
    new URL("../src/components/AudioPlayer.astro", import.meta.url),
    "utf8"
  );
  assert.match(
    source,
    /<audio\s+controls\s+preload="none"\s+src=\{fallbackTrack\.url\}/
  );
  const h = makeHarness(components[1], { failImport: true });
  h.observers[0].trigger();
  await tick();
  assert.equal(h.constructed.length, 0);
  assert.equal(h.destroyed.length, 0);
  assert.equal(h.errors.length, 1);
});

test("MediaPlayer.astro: embeds expose a watch link before enhancement", () => {
  const source = readFileSync(
    new URL("../src/components/MediaPlayer.astro", import.meta.url),
    "utf8"
  );
  assert.match(
    source,
    /class="plyr-media plyr-embed-fallback"[\s\S]*?<a href=\{embedFallbackUrl\}/
  );
  assert.match(source, /在原站观看视频/);
});

test("MediaPlayer.astro: preserves quality choices and retries a failed import", async () => {
  const h = makeHarness(components[0], { failImport: true });
  h.observers[0].trigger();
  await tick();
  assert.equal(h.constructed.length, 0);
  assert.equal(h.errors.length, 1);
  h.setImportFailure(false);
  h.event("astro:page-load");
  h.observers.at(-1).trigger();
  await tick();
  assert.equal(h.constructed.length, 1);
  assert.equal(h.constructed[0].options.quality.default, 720);
  assert.deepEqual(
    Array.from(h.constructed[0].options.quality.options),
    [1080, 720]
  );
});
