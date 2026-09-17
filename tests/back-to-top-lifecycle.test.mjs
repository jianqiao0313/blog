import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function backToTopScript() {
  const component = readFileSync(
    new URL(
      "../src/pages/posts/[...slug]/_components/BackToTopButton.astro",
      import.meta.url
    ),
    "utf8"
  );
  const modulePath = new URL("../src/scripts/backToTop.js", import.meta.url);
  if (existsSync(modulePath)) {
    assert.match(
      component,
      /<script>\s*import "@\/scripts\/backToTop\.js";\s*<\/script>/
    );
    return readFileSync(modulePath, "utf8");
  }
  return component.match(
    /<script is:inline data-astro-rerun>([\s\S]*?)<\/script>/
  )?.[1];
}

function createPage() {
  const handlers = new Map();
  let articleVisible = true;
  let clicks = 0;
  const root = { scrollHeight: 1000, clientHeight: 500, scrollTop: 0 };
  const button = {
    addEventListener(type, handler) {
      if (type === "click") (clicks++, handlers.set("button-click", handler));
    },
    removeEventListener(type) {
      if (type === "click") (clicks--, handlers.delete("button-click"));
    },
  };
  const container = { classList: { toggle() {} } };
  const indicator = { style: { setProperty() {} } };
  const document = {
    body: { scrollTop: 0 },
    documentElement: root,
    querySelector(selector) {
      if (!articleVisible) return null;
      return (
        {
          "#btt-btn-container": container,
          "[data-button='back-to-top']": button,
          "#progress-indicator": indicator,
        }[selector] ?? null
      );
    },
    addEventListener(type, handler) {
      const listeners = handlers.get(type) ?? new Set();
      listeners.add(handler);
      handlers.set(type, listeners);
    },
    removeEventListener(type, handler) {
      handlers.get(type)?.delete(handler);
    },
  };
  const context = vm.createContext({
    document,
    window: { requestAnimationFrame: callback => callback() },
  });
  return {
    context,
    count: type => handlers.get(type)?.size ?? 0,
    clickHandlers: () => clicks,
    navigate(isArticle) {
      articleVisible = isArticle;
    },
    dispatch(type) {
      for (const listener of [...(handlers.get(type) ?? [])]) listener();
    },
  };
}

test("back-to-top listeners stay bounded and detach outside articles", () => {
  const code = backToTopScript();
  assert.ok(code);
  const page = createPage();
  vm.runInContext(code, page.context);
  page.dispatch("astro:page-load");
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 1);
  assert.equal(page.clickHandlers(), 1);

  page.dispatch("astro:before-swap");
  page.navigate(false);
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 0);
  assert.equal(page.clickHandlers(), 0);

  page.navigate(true);
  page.dispatch("astro:page-load");
  page.dispatch("astro:page-load");
  assert.equal(page.count("scroll"), 1);
  assert.equal(page.clickHandlers(), 1);
});
