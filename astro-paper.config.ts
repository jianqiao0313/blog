import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://lvjianqiao.com",
    title: "原汤化原食",
    description: "给搬砖路上搞点乐子",
    author: "原汤化原食",
    profile: "https://github.com/jianqiao0313",
    ogImage: "og-image.jpg",
    lang: "zh",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/jianqiao0313/blog/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    { name: "bilibili", url: "https://space.bilibili.com/326994795"},
    { name: "youtube", url: "https://www.youtube.com/@yuantanghuayuanshia"},
    { name: "music163", url: "https://music.163.com/user/home?id=75231240"},
    { name: "steam", url: "https://steamcommunity.com/id/jianqiao0313/" },
    { name: "github", url: "https://github.com/jianqiao0313" },
    { name: "v2ex", url: "https://www.v2ex.com/member/jianqiao031313" },
    { name: "mail",   url: "mailto:jianqiao0313@126.com" },
  ],
  shareLinks: [
    // { name: "whatsapp", url: "https://wa.me/?text=" },
    // { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    // { name: "x",        url: "https://x.com/intent/post?url=" },
    // { name: "telegram", url: "https://t.me/share/url?url=" },
    // { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    // { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
