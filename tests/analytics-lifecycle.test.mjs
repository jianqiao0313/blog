import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const scriptURL = new URL("../src/scripts/analytics.ts", import.meta.url);

function analyticsScript() {
  return ts.transpileModule(readFileSync(scriptURL, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(listener);
      listeners.set(type, handlers);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

class FakeElement {
  constructor({ dataset = {}, attributes = {} } = {}) {
    this.dataset = dataset;
    this.attributes = new Map(Object.entries(attributes));
  }

  closest(selector) {
    return selector === "[data-analytics-event]" && this.dataset.analyticsEvent
      ? this
      : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function harness({ trackerReady = true, rejectTracks = false } = {}) {
  const documentEvents = eventTarget();
  const windowEvents = eventTarget();
  const trackerEvents = eventTarget();
  const tracks = [];
  const intervals = [];
  let now = 0;
  let uuid = 0;

  const location = {
    origin: "https://lvjianqiao.com",
    pathname: "/posts/a/",
    search: "?source=start",
    hash: "#intro",
    get href() {
      return `${this.origin}${this.pathname}${this.search}${this.hash}`;
    },
  };
  const document = {
    ...documentEvents,
    title: "Article A",
    referrer: "https://search.example/query?q=private",
    visibilityState: "visible",
    getElementById: id => (id === "umami-tracker" ? trackerEvents : null),
  };
  const window = {
    ...windowEvents,
    setInterval(callback, delay) {
      intervals.push({ callback, delay });
      return intervals.length;
    },
  };

  function installTracker() {
    window.umami = {
      track(callback) {
        tracks.push(
          callback({
            website: "site-id",
            hostname: "lvjianqiao.com",
            url: "must-be-overridden",
            title: "must-be-overridden",
            referrer: "must-be-overridden",
          })
        );
        return rejectTracks
          ? Promise.reject(new Error("tracker unavailable"))
          : Promise.resolve();
      },
    };
  }
  if (trackerReady) installTracker();

  const context = vm.createContext({
    exports: {},
    crypto: { randomUUID: () => `view-${++uuid}` },
    document,
    Element: FakeElement,
    location,
    performance: { now: () => now },
    Promise,
    URL,
    window,
  });
  vm.runInContext(analyticsScript(), context);

  return {
    document,
    location,
    trackerEvents,
    tracks,
    window,
    advance(milliseconds) {
      now += milliseconds;
    },
    click(element) {
      let prevented = false;
      documentEvents.dispatch("click", {
        target: element,
        preventDefault: () => {
          prevented = true;
        },
      });
      return { prevented };
    },
    dispatchDocument: documentEvents.dispatch,
    dispatchWindow: windowEvents.dispatch,
    installTracker,
    interval() {
      assert.equal(intervals.length, 1);
      intervals[0].callback();
    },
    navigate(path, title, { search = "", hash = "" } = {}) {
      documentEvents.dispatch("astro:before-swap");
      location.pathname = path;
      location.search = search;
      location.hash = hash;
      document.title = title;
      documentEvents.dispatch("astro:page-load");
    },
    setVisibility(state) {
      document.visibilityState = state;
      documentEvents.dispatch("visibilitychange");
    },
  };
}

function views(tracks) {
  return tracks.filter(track => !track.name);
}

function named(tracks, name) {
  return tracks.filter(track => track.name === name);
}

test("counts one page view per pathname and strips query and hash data", () => {
  const h = harness();
  h.dispatchDocument("astro:page-load");
  h.dispatchDocument("astro:page-load");
  assert.equal(views(h.tracks).length, 1);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(views(h.tracks)[0]).filter(([key]) =>
        ["url", "title", "referrer"].includes(key)
      )
    ),
    {
      url: "/posts/a/",
      title: "Article A",
      referrer: "https://search.example/query",
    }
  );

  h.location.search = "?q=typed-search";
  h.location.hash = "#other";
  h.dispatchDocument("astro:page-load");
  assert.equal(views(h.tracks).length, 1, "query/hash changes are not PVs");

  h.navigate("/posts/b/", "Article B", {
    search: "?campaign=secret",
    hash: "#section",
  });
  assert.equal(views(h.tracks).length, 2);
  assert.equal(views(h.tracks)[1].url, "/posts/b/");
  assert.equal(views(h.tracks)[1].title, "Article B");
  assert.equal(views(h.tracks)[1].referrer, "/posts/a/");
});

test("delayed tracker loading preserves each queued page snapshot", () => {
  const h = harness({ trackerReady: false });
  h.navigate("/posts/b/", "Article B");
  h.installTracker();
  h.trackerEvents.dispatch("load");

  assert.deepEqual(
    views(h.tracks).map(({ url, title, referrer }) => ({
      url,
      title,
      referrer,
    })),
    [
      {
        url: "/posts/a/",
        title: "Article A",
        referrer: "https://search.example/query",
      },
      { url: "/posts/b/", title: "Article B", referrer: "/posts/a/" },
    ]
  );
});

test("engagement includes visible time only and does not double-send pauses", () => {
  const h = harness();
  h.advance(5_000);
  h.setVisibility("hidden");
  assert.deepEqual(
    named(h.tracks, "page_engagement").map(({ data }) => data.seconds),
    [5]
  );

  h.advance(20_000);
  h.setVisibility("visible");
  h.advance(4_000);
  h.interval();
  h.setVisibility("hidden");
  h.dispatchWindow("pagehide");
  assert.deepEqual(
    named(h.tracks, "page_engagement").map(({ data }) => [
      data.seconds,
      data.reason,
    ]),
    [
      [5, "hidden"],
      [4, "interval"],
    ]
  );

  h.advance(60_000);
  h.setVisibility("visible");
  h.dispatchWindow("pageshow");
  h.advance(2_000);
  h.interval();
  assert.equal(named(h.tracks, "page_engagement").at(-1).data.seconds, 2);
});

test("delegated click events send only stable labels and sanitized destinations", () => {
  const h = harness();
  const internal = new FakeElement({
    dataset: { analyticsEvent: "nav_click", analyticsLabel: "posts" },
    attributes: { href: "/posts/?private=yes#hidden" },
  });
  assert.equal(h.click(internal).prevented, false);
  const external = new FakeElement({
    dataset: { analyticsEvent: "social_click", analyticsLabel: "github" },
    attributes: { href: "https://github.com/example?token=secret" },
  });
  h.click(external);
  const mail = new FakeElement({
    dataset: { analyticsEvent: "social_click", analyticsLabel: "mail" },
    attributes: { href: "mailto:private@example.com" },
  });
  h.click(mail);
  const disabled = new FakeElement({
    dataset: { analyticsEvent: "pagination_click", analyticsLabel: "next" },
    attributes: { href: "/posts/2/", "aria-disabled": "true" },
  });
  h.click(disabled);

  const events = h.tracks.filter(track => track.name?.endsWith("_click"));
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(events.map(({ name, data }) => ({ name, data })))
    ),
    [
      {
        name: "nav_click",
        data: {
          path: "/posts/a/",
          label: "posts",
          destination: "/posts/",
        },
      },
      {
        name: "social_click",
        data: {
          path: "/posts/a/",
          label: "github",
          destination: "github.com",
        },
      },
      {
        name: "social_click",
        data: { path: "/posts/a/", label: "mail" },
      },
    ]
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /private@example\.com|token=secret/
  );
});

test("tracker load failures and rejected requests never break page behavior", async () => {
  const failed = harness({ trackerReady: false });
  assert.doesNotThrow(() => failed.trackerEvents.dispatch("error"));
  failed.installTracker();
  assert.doesNotThrow(() => failed.trackerEvents.dispatch("load"));
  assert.equal(
    failed.tracks.length,
    0,
    "failed tracker drops its pending queue"
  );

  const rejected = harness({ rejectTracks: true });
  assert.doesNotThrow(() =>
    rejected.click(
      new FakeElement({ dataset: { analyticsEvent: "theme_toggle" } })
    )
  );
  await Promise.resolve();
  assert.equal(rejected.tracks.length, 2);
});

test("tracker markup disables auto tracking and limits production collection", () => {
  const source = readFileSync(
    new URL("../src/components/Analytics.astro", import.meta.url),
    "utf8"
  );
  assert.match(source, /const enabled = import\.meta\.env\.PROD/);
  assert.match(source, /transition:persist="umami-tracker"/);
  assert.match(source, /data-auto-track="false"/);
  assert.match(source, /data-domains="lvjianqiao\.com,www\.lvjianqiao\.com"/);
  assert.match(source, /data-do-not-track="true"/);
  assert.doesNotMatch(source, /password|authorization/i);
});
