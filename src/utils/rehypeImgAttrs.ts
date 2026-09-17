/** Reserve image space while preserving author sizing and loading priority. */
export function rehypeImgAttrs(
  dimensions: Record<string, { width: number; height: number }> = {}
) {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node) return;
      if (node.type === "element" && node.tagName === "img") {
        node.properties = node.properties || {};
        if (node.properties.loading == null) node.properties.loading = "lazy";
        if (node.properties.decoding == null)
          node.properties.decoding = "async";

        const size = dimensions[node.properties.src];
        if (size) {
          const { width, height } = node.properties;
          if (width == null && height == null) {
            node.properties.width = size.width;
            node.properties.height = size.height;
          } else if (height == null && Number(width) > 0) {
            node.properties.height = Math.round(
              (Number(width) * size.height) / size.width
            );
          } else if (width == null && Number(height) > 0) {
            node.properties.width = Math.round(
              (Number(height) * size.width) / size.height
            );
          }
        }
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    };
    walk(tree);
  };
}
