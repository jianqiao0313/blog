import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  cp,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  preparePagefindCache,
  refreshPagefindCache,
} from "../scripts/pagefind-cache.mjs";

test("old development index cannot leak into a fresh Astro build", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "blog-pagefind-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "public/pagefind/fragment"), { recursive: true });
  await writeFile(
    path.join(root, "public/pagefind/fragment/stale.pf_fragment"),
    "old"
  );

  await preparePagefindCache(root);
  await mkdir(path.join(root, "dist"));
  await cp(path.join(root, "public"), path.join(root, "dist"), {
    recursive: true,
  });

  assert.deepEqual(await readdir(path.join(root, "dist")), []);
});

test("refresh replaces the development index instead of merging stale fragments", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "blog-pagefind-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const generated = path.join(root, "dist/pagefind");
  const cache = path.join(root, "public/pagefind");
  await mkdir(path.join(generated, "fragment"), { recursive: true });
  await writeFile(path.join(generated, "pagefind-entry.json"), "{}");
  await writeFile(path.join(generated, "fragment/first.pf_fragment"), "first");

  await refreshPagefindCache(root);
  assert.equal(
    await readFile(path.join(cache, "fragment/first.pf_fragment"), "utf8"),
    "first"
  );

  await rm(generated, { recursive: true });
  await mkdir(path.join(generated, "fragment"), { recursive: true });
  await writeFile(path.join(generated, "pagefind-entry.json"), "{}");
  await writeFile(
    path.join(generated, "fragment/second.pf_fragment"),
    "second"
  );
  await refreshPagefindCache(root);

  assert.deepEqual(await readdir(path.join(cache, "fragment")), [
    "second.pf_fragment",
  ]);
});

test("refresh keeps the old development index if Pagefind did not generate one", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "blog-pagefind-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = path.join(root, "public/pagefind");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, "pagefind-entry.json"), "old");

  await assert.rejects(refreshPagefindCache(root), /pagefind-entry\.json/);
  assert.equal(
    await readFile(path.join(cache, "pagefind-entry.json"), "utf8"),
    "old"
  );
});
