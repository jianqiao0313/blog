import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

async function deployFixture(t, failAssets = false) {
  const root = await mkdtemp(path.join(tmpdir(), "blog-deploy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "dist/_astro"), { recursive: true });
  await mkdir(path.join(root, "bin"));
  await writeFile(
    path.join(root, "dist/index.html"),
    '<script src="/_astro/app.js"></script>'
  );
  await writeFile(path.join(root, "dist/_astro/app.js"), "app");
  // Model a legal but adversarial transfer order: HTML finishes before JS
  // whenever a single rclone invocation contains both files.
  await writeFile(
    path.join(root, "bin/rclone"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const excludes = args.flatMap((arg, i) => arg === '--exclude' ? [args[i + 1]] : []);
const includes = args.flatMap((arg, i) => arg === '--include' ? [args[i + 1]] : []);
const html = !excludes.some(p => p.includes('*.html')) && (!includes.length || includes.some(p => p.includes('*.html')));
const asset = !excludes.includes('/_astro/**') && (!includes.length || includes.some(p => p.includes('_astro')));
if (process.env.FAIL_ASSETS === '1' && asset) process.exit(17);
if (html) fs.appendFileSync('trace', fs.existsSync('asset-uploaded') ? 'html:ready\\n' : 'html:missing-asset\\n');
if (asset) fs.writeFileSync('asset-uploaded', 'yes');
`,
    { mode: 0o755 }
  );
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-oss.yml", import.meta.url),
    "utf8"
  );
  const step = workflow
    .split("      - name: Incremental upload dist/ to OSS\n")[1]
    .split("\n      - name:")[0];
  const script = step
    .split("        run: |\n")[1]
    .split("\n")
    .map(line => line.replace(/^          /, ""))
    .join("\n");
  const result = spawnSync("bash", ["-c", script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
      RCLONE_CONFIG_OSS_ACCESS_KEY_ID: "test",
      FAIL_ASSETS: failAssets ? "1" : "0",
    },
  });
  return {
    result,
    trace: await readFile(path.join(root, "trace"), "utf8").catch(() => ""),
  };
}

test("deployment publishes HTML only after its assets are available", async t => {
  const { result, trace } = await deployFixture(t);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(trace.includes("html:ready"), "HTML must be published");
  assert.ok(
    !trace.includes("html:missing-asset"),
    "HTML exposed a missing JS asset"
  );
});

test("an asset upload failure leaves live HTML untouched", async t => {
  const { result, trace } = await deployFixture(t, true);
  assert.equal(result.status, 17);
  assert.equal(trace, "");
});
