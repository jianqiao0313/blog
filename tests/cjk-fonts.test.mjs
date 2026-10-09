import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/utils/getCjkFontData.ts", import.meta.url);
const originalCwd = process.cwd();
const originalFetch = globalThis.fetch;
const originalTimeout = process.env.CJK_FONT_FETCH_TIMEOUT_MS;

async function loadModule() {
  const source = await readFile(sourcePath, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}#${Math.random()}`
  );
}

function ttf(contents) {
  const payload = Buffer.from(contents);
  const header = Buffer.alloc(28);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(1, 4);
  header.write("test", 12, "ascii");
  header.writeUInt32BE(28, 20);
  header.writeUInt32BE(payload.byteLength, 24);
  return Buffer.concat([header, payload]);
}

const fontPayload = font => Buffer.from(font.data).toString("utf8", 28);

function response(
  body,
  { status = 200, statusText = "OK", text: readText } = {}
) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: readText ?? (async () => bytes.toString("utf8")),
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

async function withTempCwd(t) {
  const root = await mkdtemp(path.join(tmpdir(), "blog-cjk-fonts-"));
  process.chdir(root);
  t.after(async () => {
    process.chdir(originalCwd);
    globalThis.fetch = originalFetch;
    if (originalTimeout === undefined)
      delete process.env.CJK_FONT_FETCH_TIMEOUT_MS;
    else process.env.CJK_FONT_FETCH_TIMEOUT_MS = originalTimeout;
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

test("English-only text does not access the font network or cache", async t => {
  const root = await withTempCwd(t);
  globalThis.fetch = () => {
    throw new Error("fetch should not run");
  };
  const { getCjkFontData } = await loadModule();

  assert.deepEqual(await getCjkFontData("Plain English"), []);
  await assert.rejects(readdir(path.join(root, ".astro/cjk-fonts")), {
    code: "ENOENT",
  });
});

test("concurrent requests share downloads and a fresh process can build offline from disk", async t => {
  await withTempCwd(t);
  const calls = [];
  globalThis.fetch = async url => {
    calls.push(url);
    if (url.includes("fonts.googleapis.com")) {
      const weight = url.includes("wght@700") ? 700 : 400;
      return response(
        `@font-face { src: url(https://fonts.example/${weight}.ttf) format('truetype'); }`
      );
    }
    return response(ttf(url.includes("700") ? "bold" : "regular"));
  };
  const firstModule = await loadModule();

  const [first, second] = await Promise.all([
    firstModule.getCjkFontData("博客"),
    firstModule.getCjkFontData("博客"),
  ]);

  assert.equal(calls.length, 4);
  assert.deepEqual(
    first.map(font => [font.weight, Buffer.from(font.data).toString("hex")]),
    second.map(font => [font.weight, Buffer.from(font.data).toString("hex")])
  );

  globalThis.fetch = () => {
    throw new Error("offline cache hit must not fetch");
  };
  const freshModule = await loadModule();
  const cached = await freshModule.getCjkFontData("博客");
  assert.deepEqual(
    cached.map(font => [font.weight, fontPayload(font)]),
    [
      [400, "regular"],
      [700, "bold"],
    ]
  );
});

test("a corrupt disk cache is discarded and downloaded again", async t => {
  const root = await withTempCwd(t);
  globalThis.fetch = async url => {
    if (url.includes("fonts.googleapis.com")) {
      const weight = url.includes("wght@700") ? 700 : 400;
      return response(
        `@font-face { src: url(https://fonts.example/${weight}.ttf) format('truetype'); }`
      );
    }
    return response(ttf("initial"));
  };
  const firstModule = await loadModule();
  await firstModule.getCjkFontData("缓存");
  const cacheDir = path.join(root, ".astro/cjk-fonts");
  const files = await readdir(cacheDir);
  const truncatedSfnt = Buffer.alloc(12);
  truncatedSfnt.writeUInt32BE(0x00010000, 0);
  truncatedSfnt.writeUInt16BE(1, 4);
  await Promise.all(
    files.map(file => writeFile(path.join(cacheDir, file), truncatedSfnt))
  );

  let fontDownloads = 0;
  globalThis.fetch = async url => {
    if (url.includes("fonts.googleapis.com")) {
      const weight = url.includes("wght@700") ? 700 : 400;
      return response(
        `@font-face { src: url(https://fonts.example/${weight}.ttf) format('truetype'); }`
      );
    }
    fontDownloads += 1;
    return response(ttf("repaired"));
  };
  const freshModule = await loadModule();
  const fonts = await freshModule.getCjkFontData("缓存");

  assert.equal(fontDownloads, 2);
  assert.deepEqual(fonts.map(fontPayload), ["repaired", "repaired"]);
});

test("HTTP failures stop the build with a useful error", async t => {
  await withTempCwd(t);
  globalThis.fetch = async () =>
    response("unavailable", { status: 503, statusText: "Unavailable" });
  const { getCjkFontData } = await loadModule();

  await assert.rejects(
    getCjkFontData("失败"),
    /CJK font CSS request failed.*503 Unavailable/
  );
});

test("stalled font requests time out instead of hanging the build", async t => {
  await withTempCwd(t);
  process.env.CJK_FONT_FETCH_TIMEOUT_MS = "5";
  globalThis.fetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  const { getCjkFontData } = await loadModule();

  await assert.rejects(getCjkFontData("超时"), /CJK font request timed out/);
});

test("the timeout also covers reading a stalled response body", async t => {
  await withTempCwd(t);
  process.env.CJK_FONT_FETCH_TIMEOUT_MS = "5";
  globalThis.fetch = async (_url, { signal }) =>
    response("unused", {
      status: 200,
      statusText: "OK",
      text: () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
  const { getCjkFontData } = await loadModule();

  await assert.rejects(
    Promise.race([
      getCjkFontData("正文"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("body read stayed pending")), 100)
      ),
    ]),
    /CJK font request timed out/
  );
});
