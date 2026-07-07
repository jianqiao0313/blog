/**
 * rehype plugin: add `loading="lazy"` and `decoding="async"` to every <img>
 * in post content (the posts use 150+ external CDN images). Defers off-screen
 * image downloads and lets the browser decode them off the main thread.
 */
export function rehypeImgAttrs() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node) return;
      if (node.type === "element" && node.tagName === "img") {
        node.properties = node.properties || {};
        if (node.properties.loading == null) node.properties.loading = "lazy";
        if (node.properties.decoding == null)
          node.properties.decoding = "async";
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}
