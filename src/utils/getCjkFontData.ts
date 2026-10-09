import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fetches a small Noto Sans SC (思源黑体 / 黑体 style, the redistributable
 * SIL-OFL equivalent of Microsoft YaHei) glyph subset from Google Fonts so that
 * Chinese text renders in dynamically generated OG images.
 *
 * satori cannot decode WOFF2, so we send a legacy User-Agent to make Google
 * Fonts serve TrueType. Only the glyphs in `text` are downloaded (a few KB),
 * so there is no multi-MB font to commit and English-only content makes no
 * network request at all.
 */

type SatoriFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

export const CJK_FONT_FAMILY = "Noto Sans SC";

// Han ideographs (incl. Ext. A), compatibility ideographs, CJK punctuation,
// and fullwidth/halfwidth forms — enough to decide whether a fetch is needed.
const CJK_RE = /[㐀-鿿豈-﫿＀-￯　-〿]/;

// Old UA → Google Fonts serves TrueType instead of WOFF2 (satori-readable).
const LEGACY_UA =
  "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-US) AppleWebKit/534.30";

const CACHE_DIRECTORY = path.join(".astro", "cjk-fonts");
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const fontRequests = new Map<string, Promise<SatoriFont[]>>();

export function hasCjk(text: string): boolean {
  return CJK_RE.test(text);
}

async function fetchSubset(
  weight: 400 | 700,
  text: string
): Promise<ArrayBuffer> {
  const cachePath = getCachePath(weight, text);
  const cached = await readCachedFont(cachePath);
  if (cached) return toArrayBuffer(cached);

  const url =
    `https://fonts.googleapis.com/css2?family=` +
    `${encodeURIComponent(CJK_FONT_FAMILY)}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;

  const css = await fetchWithTimeout(
    url,
    { headers: { "User-Agent": LEGACY_UA } },
    "CSS",
    response => response.text()
  );

  const match = css.match(
    /src:\s*url\((https:[^)]+)\)\s*format\(['"]?truetype['"]?\)/i
  );
  if (!match) {
    throw new Error(
      `CJK font CSS did not contain a TrueType URL for weight ${weight}`
    );
  }

  const font = Buffer.from(
    await fetchWithTimeout(match[1], {}, "file", response =>
      response.arrayBuffer()
    )
  );
  if (!isValidTrueType(font)) {
    throw new Error(`Downloaded CJK font is invalid for weight ${weight}`);
  }

  await writeCachedFont(cachePath, font);
  return toArrayBuffer(font);
}

function getCachePath(weight: 400 | 700, text: string): string {
  const digest = createHash("sha256").update(text).digest("hex");
  return path.join(process.cwd(), CACHE_DIRECTORY, `${digest}-${weight}.ttf`);
}

async function readCachedFont(cachePath: string): Promise<Buffer | null> {
  try {
    const font = await readFile(cachePath);
    if (isValidTrueType(font)) return font;
    await rm(cachePath, { force: true });
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeCachedFont(cachePath: string, font: Buffer): Promise<void> {
  await mkdir(path.dirname(cachePath), { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, font);
    await rename(temporaryPath, cachePath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

function isValidTrueType(font: Uint8Array): boolean {
  if (
    font.byteLength < 12 ||
    font[0] !== 0 ||
    font[1] !== 1 ||
    font[2] !== 0 ||
    font[3] !== 0
  ) {
    return false;
  }

  const view = new DataView(font.buffer, font.byteOffset, font.byteLength);
  const tableCount = view.getUint16(4);
  const directoryEnd = 12 + tableCount * 16;
  if (tableCount === 0 || directoryEnd > font.byteLength) return false;

  for (let offset = 12; offset < directoryEnd; offset += 16) {
    const tableOffset = view.getUint32(offset + 8);
    const tableLength = view.getUint32(offset + 12);
    if (
      tableOffset > font.byteLength ||
      tableLength > font.byteLength - tableOffset
    ) {
      return false;
    }
  }
  return true;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function fetchWithTimeout<T>(
  url: string,
  init: RequestInit,
  resource: "CSS" | "file",
  readBody: (response: Response) => Promise<T>
): Promise<T> {
  const timeoutMs = getFetchTimeout();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `CJK font ${resource} request failed: ${response.status} ${response.statusText} (${url})`
      );
    }
    return await readBody(response);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        `CJK font request timed out after ${timeoutMs}ms (${url})`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function getFetchTimeout(): number {
  const configured = Number(process.env.CJK_FONT_FETCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_FETCH_TIMEOUT_MS;
}

function normalizeSubsetText(text: string): string {
  return [...new Set(text)].sort().join("");
}

/**
 * Returns satori font entries (weights 400 & 700) covering the CJK glyphs in
 * `text`. Returns `[]` when there is no CJK text. CJK download failures reject
 * with a clear error so a build cannot silently publish unreadable OG images.
 */
export async function getCjkFontData(text: string): Promise<SatoriFont[]> {
  if (!hasCjk(text)) return [];

  const subsetText = normalizeSubsetText(text);
  const existing = fontRequests.get(subsetText);
  if (existing) return existing;

  const request = (async () => {
    const [regular, bold] = await Promise.all([
      fetchSubset(400, subsetText),
      fetchSubset(700, subsetText),
    ]);

    return [
      {
        name: CJK_FONT_FAMILY,
        data: regular,
        weight: 400,
        style: "normal",
      },
      {
        name: CJK_FONT_FAMILY,
        data: bold,
        weight: 700,
        style: "normal",
      },
    ] satisfies SatoriFont[];
  })();

  fontRequests.set(subsetText, request);
  request.catch(() => fontRequests.delete(subsetText));
  return request;
}
