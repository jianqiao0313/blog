# 原汤化原食 的博客

前端切图仔，小时候学过几年萨克斯，打算拿电吹管把喜欢的音乐改编耍耍，在搬砖路上搞点乐子。

- 线上地址：<https://lvjianqiao.com>
- 作者：原汤化原食（[@jianqiao0313](https://github.com/jianqiao0313)）

## 技术栈

- [Astro](https://astro.build/) + [Tailwind CSS](https://tailwindcss.com/)，主题基于 [AstroPaper](https://github.com/satnaing/astro-paper)
- 评论与统计：[Waline](https://waline.js.org/)（文章反应、阅读量、评论数）
- 文章目录（TOC）：`remark-toc` + `remark-collapse`，在文章里写 `## 目录` 即自动生成
- 五线谱：在文章里写 ` ```abc ` 代码块（[ABC 记谱法](https://abcnotation.com/)），由 [abcjs](https://www.abcjs.net/) 渲染

## 本地开发

需要 Node `>=22.12` 和 pnpm。

```bash
pnpm install
pnpm dev        # 本地开发，http://localhost:4321
pnpm build      # 生产构建（含 astro check + pagefind 搜索索引）
pnpm preview    # 预览构建产物
```

`pnpm build` 会重新生成 Pagefind 索引，并更新用于本地开发的 `public/pagefind` 缓存。修改文章后，运行一次构建即可在 `pnpm dev` 中查看最新搜索结果。

## 写文章

在 `src/content/posts/` 下新建 `.md` 文件，frontmatter 至少包含：

```yaml
---
title: "标题"
pubDatetime: 2024-01-01T10:00:00+08:00
description: "用于列表摘要、SEO 与 OG 图的一句话描述"
tags:
  - 标签
---
```

正文里可用 `## 目录` 生成目录、用 ` ```abc ` 代码块插入五线谱。

新增或替换远程 Markdown 图片时，测量原图尺寸并更新 `src/assets/image-dimensions.json`。已有 HTML `width`/`height` 会保留；`pnpm test` 会检查当前文章的图片尺寸元数据。构建时不会请求图片 CDN。

## 部署

推送到 `main` 后由 GitHub Actions（`.github/workflows/deploy-oss.yml`）构建并发布到阿里云 OSS。

## 致谢

主题基于 [AstroPaper](https://github.com/satnaing/astro-paper)（MIT，作者 Sat Naing）。
