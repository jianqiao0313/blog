import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const sourceURL = new URL("../src/utils/rehypeImgAttrs.ts", import.meta.url);
const compiled = ts.transpileModule(readFileSync(sourceURL, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const exports = {};
runInNewContext(compiled, { exports, require: createRequire(sourceURL) });
const dimensions = JSON.parse(
  readFileSync(
    new URL("../src/assets/image-dimensions.json", import.meta.url),
    "utf8"
  )
);
const transform = exports.rehypeImgAttrs(dimensions);
const src = "https://static.xiaogezi.fun/images/git/1.png";
const image = properties => ({ type: "element", tagName: "img", properties });

test("article Markdown images receive their measured intrinsic size", () => {
  let count = 0;
  const directory = new URL("../src/content/posts/", import.meta.url);
  for (const name of readdirSync(directory).filter(name =>
    name.endsWith(".md")
  )) {
    const text = readFileSync(new URL(name, directory), "utf8");
    for (const [, url] of text.matchAll(/!\[[^\]]*\]\((https:\/\/[^)]+)\)/g)) {
      const node = image({ src: url });
      transform({ children: [node] });
      assert.ok(node.properties.width > 0, `${url} needs width`);
      assert.ok(node.properties.height > 0, `${url} needs height`);
      assert.equal(node.properties.loading, "lazy");
      assert.equal(node.properties.decoding, "async");
      count++;
    }
  }
  assert.ok(count > 0, "expected at least one Markdown image to verify");
});

test("known dimensions match the measured CDN image", () => {
  const node = image({ src });
  transform(node);
  assert.equal(node.properties.width, 1374);
  assert.equal(node.properties.height, 510);
});

test("preserves author dimensions and loading priority", () => {
  const node = image({
    src,
    width: 400,
    height: 200,
    loading: "eager",
    decoding: "sync",
  });
  transform(node);
  assert.deepEqual(node.properties, {
    src,
    width: 400,
    height: 200,
    loading: "eager",
    decoding: "sync",
  });
});

test("a single author dimension preserves the intrinsic aspect ratio", () => {
  const node = image({ src, width: 687 });
  transform(node);
  assert.equal(node.properties.width, 687);
  assert.equal(node.properties.height, 255);
});

test("unknown images keep explicit attributes without invented dimensions", () => {
  const node = image({ src: "https://example.com/new.png", alt: "New image" });
  transform({ children: [{ children: [node] }] });
  assert.equal(node.properties.width, undefined);
  assert.equal(node.properties.height, undefined);
  assert.equal(node.properties.alt, "New image");
  assert.equal(node.properties.loading, "lazy");
});
