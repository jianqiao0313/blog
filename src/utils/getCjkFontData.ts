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

export function hasCjk(text: string): boolean {
  return CJK_RE.test(text);
}

async function fetchSubset(
  weight: 400 | 700,
  text: string
): Promise<ArrayBuffer | null> {
  const url =
    `https://fonts.googleapis.com/css2?family=` +
    `${encodeURIComponent(CJK_FONT_FAMILY)}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;

  const css = await fetch(url, {
    headers: { "User-Agent": LEGACY_UA },
  }).then(res => res.text());

  const match = css.match(
    /src:\s*url\((https:[^)]+)\)\s*format\(['"]?truetype['"]?\)/i
  );
  if (!match) return null;

  return fetch(match[1]).then(res => res.arrayBuffer());
}

/**
 * Returns satori font entries (weights 400 & 700) covering the CJK glyphs in
 * `text`. Returns `[]` when there is no CJK text, or when the network fetch
 * fails — so OG generation degrades gracefully rather than breaking the build.
 */
export async function getCjkFontData(text: string): Promise<SatoriFont[]> {
  if (!hasCjk(text)) return [];

  try {
    const [regular, bold] = await Promise.all([
      fetchSubset(400, text),
      fetchSubset(700, text),
    ]);

    const fonts: SatoriFont[] = [];
    if (regular)
      fonts.push({
        name: CJK_FONT_FAMILY,
        data: regular,
        weight: 400,
        style: "normal",
      });
    if (bold)
      fonts.push({
        name: CJK_FONT_FAMILY,
        data: bold,
        weight: 700,
        style: "normal",
      });
    return fonts;
  } catch {
    return [];
  }
}
