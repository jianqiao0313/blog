import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function articleScript() {
  const modulePath = new URL("../src/scripts/article.js", import.meta.url);
  const page = readFileSync(
    new URL("../src/pages/posts/[...slug]/index.astro", import.meta.url),
    "utf8"
  );
  if (existsSync(modulePath)) {
    assert.match(
      page,
      /<script>\s*import "@\/scripts\/article\.js";\s*<\/script>/
    );
    return readFileSync(modulePath, "utf8");
  }
  return page.match(
    /<script is:inline data-astro-rerun>([\s\S]*?)<\/script>/
  )?.[1];
}

function createPage({ withDecorations = false, withImage = false } = {}) {
  const handlers = new Map();
  const elements = [];
  let articleVisible = true;

  function createElement(tagName) {
    const children = [];
    return {
      tagName,
      style: {},
      classList: { add: () => {}, remove: () => {} },
      children,
      appendChild(child) {
        children.push(child);
        child.parentNode = this;
      },
      append(...items) {
        items.forEach(item => this.appendChild(item));
      },
      querySelector(selector) {
        const className = selector.replace(":scope > .", "");
        return (
          children.find(child =>
            child.className?.split(" ").includes(className)
          ) ?? null
        );
      },
      setAttribute() {},
      addEventListener() {},
      focus() {},
      remove() {
        const i = elements.indexOf(this);
        if (i >= 0) elements.splice(i, 1);
      },
    };
  }

  const heading = createElement("h2");
  heading.id = "example";
  const pre = createElement("pre");
  pre.parentNode = { insertBefore: () => {} };
  const image = createElement("img");
  image.src = "https://example.com/image.jpg";
  image.alt = "Example";
  image.closest = selector => (selector === "img" ? image : null);
  const articleListeners = new Map();
  const article = {
    querySelectorAll(selector) {
      if (selector === "img") return withImage ? [image] : [];
      if (!withDecorations) return [];
      if (selector.startsWith("h2")) return [heading];
      if (selector === "pre") return [pre];
      return [];
    },
    contains: element => element === image,
    addEventListener(type, listener) {
      articleListeners.set(type, listener);
    },
    removeEventListener(type) {
      articleListeners.delete(type);
    },
  };

  const document = {
    body: {
      style: {},
      scrollTop: 0,
      appendChild(element) {
        elements.push(element);
      },
    },
    documentElement: { scrollTop: 0, scrollHeight: 1000, clientHeight: 500 },
    createElement,
    querySelectorAll: () => [],
    getElementById(id) {
      if (id === "article") return articleVisible ? article : null;
      if (id === "myBar") {
        return (
          elements
            .flatMap(element => element.children)
            .find(child => child.id === id) ?? null
        );
      }
      return null;
    },
    addEventListener(type, listener) {
      const listeners = handlers.get(type) ?? new Set();
      listeners.add(listener);
      handlers.set(type, listeners);
    },
    removeEventListener(type, listener) {
      handlers.get(type)?.delete(listener);
    },
  };
  const window = { matchMedia: () => ({ matches: true }), scrollTo: () => {} };
  const context = vm.createContext({
    document,
    window,
    requestAnimationFrame: callback => callback(),
    setTimeout,
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
  });
  return {
    context,
    heading,
    pre,
    clickImage() {
      articleListeners.get("click")?.({ target: image, preventDefault() {} });
    },
    bodyOverflow: () => document.body.style.overflow,
    overlays: () =>
      elements.filter(element => element.className?.includes("cursor-zoom-out"))
        .length,
    count: type => handlers.get(type)?.size ?? 0,
    progressBars: () =>
      elements.filter(element =>
        element.className?.includes("progress-container")
      ).length,
    navigate(isArticle) {
      articleVisible = isArticle;
    },
    dispatch(type) {
      for (const listener of [...(handlers.get(type) ?? [])]) listener();
    },
  };
}

test("article navigation keeps one scroll listener and clears it when leaving", () => {
  const code = articleScript();
  assert.ok(code, "article client script exists");
  const page = createPage();
  vm.runInContext(code, page.context);
  page.dispatch("astro:page-load");
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 1);
  assert.equal(page.progressBars(), 1);

  page.dispatch("astro:before-swap");
  page.navigate(false);
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 0);
  assert.equal(page.progressBars(), 0);

  page.navigate(true);
  page.dispatch("astro:page-load");
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 1);
  assert.equal(page.progressBars(), 1);
  assert.equal(page.count("astro:after-swap"), 0);
});

test("open lightbox closes and releases its keyboard listener on navigation", () => {
  const page = createPage({ withImage: true });
  vm.runInContext(articleScript(), page.context);
  page.clickImage();
  assert.equal(page.overlays(), 1);
  assert.equal(page.bodyOverflow(), "hidden");
  assert.equal(page.count("keydown"), 1);

  page.dispatch("astro:before-swap");
  assert.equal(page.overlays(), 0);
  assert.equal(page.bodyOverflow(), "");
  assert.equal(page.count("keydown"), 0);
});

test("heading anchors and copy controls remain singular on repeated initialization", () => {
  const page = createPage({ withDecorations: true });
  vm.runInContext(articleScript(), page.context);
  page.dispatch("astro:page-load");
  page.dispatch("astro:page-load");
  assert.equal(
    page.heading.children.filter(child =>
      child.className?.includes("heading-link")
    ).length,
    1
  );
  assert.equal(
    page.pre.children.filter(child => child.className?.includes("copy-code"))
      .length,
    1
  );

  page.dispatch("astro:before-swap");
  page.dispatch("astro:page-load");
  assert.equal(
    page.heading.children.filter(child =>
      child.className?.includes("heading-link")
    ).length,
    1
  );
  assert.equal(
    page.pre.children.filter(child => child.className?.includes("copy-code"))
      .length,
    1
  );
});
