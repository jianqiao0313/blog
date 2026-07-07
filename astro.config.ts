import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import { remarkAbcMusic } from "./src/utils/remarkAbcMusic";
import { rehypeImgAttrs } from "./src/utils/rehypeImgAttrs";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";

const googleSansCodeFontDir = "./src/assets/fonts/google-sans-code";

export default defineConfig({
  site: config.site.url,
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        config.features?.showArchives !== false || !page.endsWith("/archives/"),
    }),
  ],
  i18n: {
    locales: ["zh"],
    defaultLocale: "zh",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkAbcMusic,
        [
          remarkToc,
          { heading: "目录|toc|table[ -]of[ -]contents?", maxDepth: 3 },
        ],
        [remarkCollapse, { test: "目录|Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts, rehypeImgAttrs],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.local(),
      fallbacks: ["monospace"],
      options: {
        variants: [
          {
            weight: 300,
            style: "normal",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-300-normal-c26ad40d3b1d9169.woff`,
            ],
          },
          {
            weight: 300,
            style: "italic",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-300-italic-02154cca78ac33f2.woff`,
            ],
          },
          {
            weight: 400,
            style: "normal",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-400-normal-87ca066ba5b2c7cf.woff`,
            ],
          },
          {
            weight: 400,
            style: "italic",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-400-italic-3a32a7a7a67f4f58.woff`,
            ],
          },
          {
            weight: 500,
            style: "normal",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-500-normal-a9a0e80c053be3d5.woff`,
            ],
          },
          {
            weight: 500,
            style: "italic",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-500-italic-a5c5808c25effec9.woff`,
            ],
          },
          {
            weight: 600,
            style: "normal",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-600-normal-da468df88542c99b.woff`,
            ],
          },
          {
            weight: 600,
            style: "italic",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-600-italic-14314705006234cb.woff`,
            ],
          },
          {
            weight: 700,
            style: "normal",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-700-normal-f914de358bc554f6.woff`,
            ],
          },
          {
            weight: 700,
            style: "italic",
            display: "swap",
            src: [
              `${googleSansCodeFontDir}/font-google-sans-code-700-italic-c33265ba093eb291.woff`,
            ],
          },
        ],
      },
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
