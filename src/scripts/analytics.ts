type EventData = Record<string, string | number>;
type Payload = Record<string, unknown>;
type Page = { path: string; title: string; referrer: string; viewId: string };
type QueuedEvent = { page: Page; name?: string; data?: EventData };

declare global {
  interface Window {
    umami?: {
      track: (
        payload: (defaults: Payload) => Payload
      ) => Promise<unknown> | void;
    };
    __blogAnalyticsStarted?: boolean;
  }
}

export function initAnalytics() {
  const tracker = document.getElementById("umami-tracker");
  if (!tracker || window.__blogAnalyticsStarted) return;
  window.__blogAnalyticsStarted = true;

  let page: Page | null = null;
  let visibleSince: number | null = null;
  let activeMs = 0;
  let unavailable = false;
  const pending: QueuedEvent[] = [];

  function send(event: QueuedEvent) {
    if (unavailable) return;
    if (!window.umami) {
      // Bound memory when a tracker is blocked or slow. Keep navigation snapshots.
      if (pending.length < 100) pending.push(event);
      return;
    }
    try {
      const result = window.umami.track(defaults => ({
        ...defaults,
        url: event.page.path,
        title: event.page.title,
        referrer: event.page.referrer,
        ...(event.name ? { name: event.name, data: event.data } : {}),
      }));
      // Analytics must never interrupt navigation or produce unhandled rejections.
      Promise.resolve(result).catch(() => {});
    } catch {
      // The blog remains usable if the external tracker fails.
    }
  }

  function flushPending() {
    if (!window.umami) return;
    pending.splice(0).forEach(send);
  }

  function event(name: string, data: EventData = {}) {
    if (page) send({ page, name, data: { path: page.path, ...data } });
  }

  function flushEngagement(reason: string) {
    if (!page) return;
    if (visibleSince !== null) {
      const now = performance.now();
      activeMs += Math.max(0, now - visibleSince);
      visibleSince = now;
    }
    if (activeMs < 1000) return;
    event("page_engagement", {
      seconds: Math.round(activeMs) / 1000,
      page_view_id: page.viewId,
      reason,
    });
    activeMs = 0;
  }

  function resume() {
    if (
      page &&
      visibleSince === null &&
      document.visibilityState === "visible"
    ) {
      visibleSince = performance.now();
    }
  }

  function pause(reason: string) {
    flushEngagement(reason);
    visibleSince = null;
  }

  function initialReferrer() {
    if (!document.referrer) return "";
    try {
      const url = new URL(document.referrer);
      return url.origin === location.origin
        ? url.pathname
        : `${url.origin}${url.pathname}`;
    } catch {
      return "";
    }
  }

  function startPage() {
    const path = location.pathname;
    // Astro's initial page-load and query/hash-only changes are not extra PVs.
    if (page?.path === path) {
      resume();
      return;
    }
    pause("navigation");
    const referrer = page?.path ?? initialReferrer();
    page = {
      path,
      title: document.title,
      referrer,
      viewId: crypto.randomUUID(),
    };
    activeMs = 0;
    resume();
    send({ page });
  }

  document.addEventListener("astro:before-swap", () => pause("navigation"));
  document.addEventListener("astro:page-load", startPage);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pause("hidden");
    else resume();
  });
  window.addEventListener("pagehide", () => pause("pagehide"));
  // A restored bfcache page resumes its existing view without counting time away.
  window.addEventListener("pageshow", resume);
  window.setInterval(() => flushEngagement("interval"), 15_000);

  document.addEventListener(
    "click",
    click => {
      if (!(click.target instanceof Element)) return;
      const target = click.target.closest<HTMLElement>(
        "[data-analytics-event]"
      );
      if (
        !target ||
        target.hasAttribute("disabled") ||
        target.getAttribute("aria-disabled") === "true"
      )
        return;

      const name = target.dataset.analyticsEvent;
      if (!name) return;
      const data: EventData = {};
      if (target.dataset.analyticsLabel)
        data.label = target.dataset.analyticsLabel;
      const href = target.getAttribute("href");
      if (href) {
        try {
          const url = new URL(href, location.href);
          if (url.protocol === "http:" || url.protocol === "https:") {
            data.destination =
              url.origin === location.origin ? url.pathname : url.hostname;
          }
        } catch {
          // Ignore malformed destinations; never collect free text or form values.
        }
      }
      event(name, data);
    },
    { capture: true }
  );

  tracker.addEventListener("load", flushPending, { once: true });
  tracker.addEventListener(
    "error",
    () => {
      unavailable = true;
      pending.length = 0;
    },
    { once: true }
  );
  startPage();
  flushPending();
}

initAnalytics();
