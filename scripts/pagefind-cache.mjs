import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function preparePagefindCache(root) {
  await rm(path.join(root, "public/pagefind"), {
    recursive: true,
    force: true,
  });
}

export async function refreshPagefindCache(root) {
  const generated = path.join(root, "dist/pagefind");
  const entry = path.join(generated, "pagefind-entry.json");
  if (!(await stat(entry).catch(() => null))?.isFile()) {
    throw new Error(`Pagefind did not generate ${entry}`);
  }

  const publicDir = path.join(root, "public");
  const cache = path.join(publicDir, "pagefind");
  await mkdir(publicDir, { recursive: true });
  await rm(cache, { recursive: true, force: true });
  await cp(generated, cache, { recursive: true });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const action = process.argv[2];
  const root = process.cwd();
  try {
    if (action === "prepare") {
      await preparePagefindCache(root);
    } else if (action === "refresh") {
      await refreshPagefindCache(root);
    } else {
      throw new Error("Usage: node scripts/pagefind-cache.mjs prepare|refresh");
    }
  } catch (error) {
    process.stderr.write(`${error}\n`);
    process.exitCode = 1;
  }
}
