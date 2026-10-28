# Umami 访问统计

后台：[umami.xiaogezi.fun:4433](https://umami.xiaogezi.fun:4433)。站点为「原汤化原食」，Website ID 为 `0a18d974-23c1-48c6-92a6-7a37b7bef6ff`。

配置入口：`src/components/Analytics.astro`；客户端采集：`src/scripts/analytics.ts`。Website ID 是公开标识，仓库不保存后台账号密码。

## 统计口径

- **访客、访问次数、浏览量、来源、设备**：查看 Umami「概览」。访客是 Umami 按自身规则估算的独立访客，并非实名人数。
- **PV**：首次进入及 Astro 路由的 pathname 变化各记录一次；标题在页面切换完成后读取。搜索 `?q`、其他 query 和 hash 变化不增加 PV，也不随事件发送。
- **访问时长**：Umami 的会话时长按服务端规则计算。下方 `page_engagement` 用于查看每页前台可见停留时长，二者口径不同。
- **前台可见停留**：每 15 秒、切换页面、页面隐藏或离开时，发送自上次上报以来新增的可见秒数；隐藏期间暂停。小于 1 秒的尾段不单独发送。它表示页面可见时间，不保证用户始终专注阅读。

`page_engagement` 的属性：

| 属性 | 含义 |
| --- | --- |
| `path` | 页面路径 |
| `seconds` | 本段新增可见秒数，数值类型 |
| `page_view_id` | 本次页面浏览的随机 ID；用于合并同一浏览的多个时间段，不标识用户 |
| `reason` | `interval`、`navigation`、`hidden`、`pagehide` |

按 `path` 汇总 `seconds` 可得到页面总可见时长；按 `page_view_id` 汇总得到一次浏览的可见时长。**不要直接把单条 `seconds` 的平均值当成平均页面停留时间**，因为一次浏览会产生多个增量事件。需要精确平均值时，导出事件数据后按浏览 ID 分组求和再平均；事件被拦截、断网或浏览器直接终止时可能少报。

## 点击事件

| 事件 | 交互 | 可选 `label` |
| --- | --- | --- |
| `nav_click` | 顶部与首页导航 | home、posts、tags、about、archives、search |
| `menu_toggle` / `theme_toggle` | 菜单 / 主题切换 | — |
| `rss_click` | RSS 订阅入口 | — |
| `post_click` / `tag_click` | 文章卡片 / 标签 | — |
| `pagination_click` | 列表翻页 | prev、next |
| `adjacent_post_click` | 上一篇 / 下一篇 | prev、next |
| `social_click` / `share_click` | 社交链接 / 文章分享 | 平台名 |
| `back_click` / `back_to_top` | 返回 / 回到顶部 | — |
| `edit_post_click` / `copy_code` | 编辑文章 / 点击复制代码 | — |

事件都带当前 `path`。链接目标 `destination` 只记录站内 pathname 或外站 hostname；不记录 URL 查询参数、锚点、邮箱、评论、搜索词或表单内容。复制事件表示点击尝试，并不证明剪贴板写入成功。

新增按钮时使用固定属性：

```html
<button data-analytics-event="example_click" data-analytics-label="fixed-label">
  示例
</button>
```

统一委托监听不会阻止默认跳转；禁用控件不计数。不要同时加 `data-umami-event` 或再次加载自动 PV 脚本，避免重复计数或接管 Astro 导航。

## 环境与验证

- 仅生产构建输出 tracker；`pnpm dev` 不采集。
- tracker 的域名白名单为 `lvjianqiao.com,www.lvjianqiao.com`，本地预览不会向真实站点写入统计；遵守浏览器 Do Not Track 和 Umami 的本地禁用设置。
- 公网地址必须保留 `:4433`。统计服务不可达时，不影响博客阅读、搜索和按钮原有行为。
- `pnpm test` 覆盖生命周期与延迟加载；提交前执行 `pnpm lint`、`pnpm format:check`、`pnpm build`。
- `main` 的推送触发现有 GitHub Actions 构建、OSS 上传和 CDN 刷新。上线后在 Umami「实时」核验页面浏览及按钮事件；验证数据本身也属于站点访问。

实现参考：[Umami 3.4.1 tracker 源码](https://github.com/umami-software/umami/blob/v3.4.1/src/tracker/index.ts)、[Astro View Transitions 生命周期](https://docs.astro.build/en/guides/view-transitions/#lifecycle-events)。
