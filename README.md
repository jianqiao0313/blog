# jianqiao0313 的博客

吕健侨的个人技术博客，记录前端开发中的笔记与踩坑，主题涵盖 Angular、Node.js、CSS、Linux、构建工具与各种工程实践。文章大多由早期的 Hexo 博客迁移而来。

- 线上地址：<https://lvjianqiao.top>
- 作者：吕健侨（[@jianqiao0313](https://github.com/jianqiao0313)）

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

## 部署

推送到 `main` 后由 GitHub Actions（`.github/workflows/deploy-oss.yml`）构建并发布到阿里云 OSS。

## 致谢

主题基于 [AstroPaper](https://github.com/satnaing/astro-paper)（MIT，作者 Sat Naing）。
