/**
 * remark plugin: turn ```abc fenced code blocks into a container that abcjs
 * renders into staff notation on the client (see components/AbcMusic.astro).
 *
 * Runs before Shiki, so the ABC source is never syntax-highlighted or shown
 * as a code block. The ABC text is stashed (HTML-escaped) in `data-abc`.
 */
export function remarkAbcMusic() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node || !Array.isArray(node.children)) return;
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        if (child && child.type === "code" && child.lang === "abc") {
          const data = String(child.value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\r?\n/g, "&#10;");
          node.children[i] = {
            type: "html",
            value: `<div class="abc-music" data-abc="${data}"></div>`,
          };
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}
