# 性能 / 包体静态审计

生成时间：2026-11-25T02:00:46.007Z

## 包体概况

- 计入包体文件：**251** 个 / **752.6 KB**
- 已通过 `project.config.json → packOptions.ignore` 排除 tools/docs/.github/server 等非运行文件。

| 目录 | 大小 | 占比 |
|---|---:|---:|
| styles | 161.0 KB | 21.4% |
| lib | 154.4 KB | 20.5% |
| assets | 136.8 KB | 18.2% |
| pages | 105.4 KB | 14.0% |
| utils | 74.4 KB | 9.9% |
| services | 65.5 KB | 8.7% |
| templates | 28.0 KB | 3.7% |
| components | 12.1 KB | 1.6% |
| cloudfunctions | 6.2 KB | 0.8% |
| custom-tab-bar | 2.1 KB | 0.3% |
| project.config.json | 2.1 KB | 0.3% |
| app.js | 2.0 KB | 0.3% |
| app.json | 1.6 KB | 0.2% |
| .eslintrc.js | 0.6 KB | 0.1% |
| sitemap.json | 0.2 KB | 0.0% |

## 文件类型

| 类型 | 大小 | 占比 |
|---|---:|---:|
| .js | 318.4 KB | 42.3% |
| .wxss | 196.4 KB | 26.1% |
| .png | 119.7 KB | 15.9% |
| .wxml | 89.1 KB | 11.8% |
| .svg | 17.1 KB | 2.3% |
| (none) | 6.0 KB | 0.8% |
| .json | 5.9 KB | 0.8% |

## 最大文件

| 文件 | 大小 |
|---|---:|
| styles/base.wxss | 79.6 KB |
| lib/shared/base.js | 57.2 KB |
| styles/legacy.wxss | 46.3 KB |
| styles/v6.wxss | 29.9 KB |
| services/mock/seed.js | 28.9 KB |
| templates/m-flow.wxml | 20.7 KB |
| services/mock/index.js | 19.8 KB |
| lib/core.js | 18.2 KB |
| lib/shared/overrides.js | 16.2 KB |
| utils/posterKit/templates/weekly34.js | 13.3 KB |
| lib/shared/mixins/craft.js | 12.1 KB |
| utils/posterKit/templates/memorial34.js | 11.6 KB |
| lib/shared/mixins/collection.js | 11.1 KB |
| lib/shared/mixins/poster.js | 11.0 KB |
| utils/posterKit/templates/weekly916.js | 10.8 KB |
| utils/posterKit/helpers.js | 10.5 KB |
| pages/edit/index.wxml | 9.9 KB |
| utils/posterKit/templates/highlight34.js | 9.4 KB |
| utils/posterKit/templates/memorial916.js | 8.2 KB |
| services/real/index.js | 8.1 KB |

## 图片资源

| 文件 | 大小 |
|---|---:|
| assets/icons/v6/compass-ink.png | 3.0 KB |
| assets/icons/v6/tab-home.png | 3.0 KB |
| assets/icons/v6/heart-ink.png | 3.0 KB |
| assets/icons/v6/sparkles-brand.png | 2.9 KB |
| assets/icons/v6/message-circle-ink.png | 2.9 KB |
| assets/icons/v6/message-circle-brand.png | 2.9 KB |
| assets/icons/v6/compass-brand.png | 2.9 KB |
| assets/icons/v6/tab-home-on.png | 2.9 KB |
| assets/icons/v6/sparkles-ink.png | 2.9 KB |
| assets/icons/v6/heart-brand.png | 2.8 KB |
| assets/icons/v6/clock-ink.png | 2.3 KB |
| assets/icons/v6/clock-brand.png | 2.2 KB |
| assets/icons/v6/tab-me.png | 2.2 KB |
| assets/icons/camera-orange.png | 2.2 KB |
| assets/icons/v6/user-round-ink.png | 2.2 KB |

## 最大 JS / WXSS

| JS | 大小 |
|---|---:|
| lib/shared/base.js | 57.2 KB |
| services/mock/seed.js | 28.9 KB |
| services/mock/index.js | 19.8 KB |
| lib/core.js | 18.2 KB |
| lib/shared/overrides.js | 16.2 KB |
| utils/posterKit/templates/weekly34.js | 13.3 KB |
| lib/shared/mixins/craft.js | 12.1 KB |
| utils/posterKit/templates/memorial34.js | 11.6 KB |
| lib/shared/mixins/collection.js | 11.1 KB |
| lib/shared/mixins/poster.js | 11.0 KB |
| utils/posterKit/templates/weekly916.js | 10.8 KB |
| utils/posterKit/helpers.js | 10.5 KB |

| WXSS | 大小 |
|---|---:|
| styles/base.wxss | 79.6 KB |
| styles/legacy.wxss | 46.3 KB |
| styles/v6.wxss | 29.9 KB |
| styles/archive.wxss | 5.2 KB |
| pages/draw/index.wxss | 5.0 KB |
| pages/cards/index.wxss | 4.0 KB |
| components/navigation-bar/navigation-bar.wxss | 3.7 KB |
| pages/set/index.wxss | 3.5 KB |
| pages/edit/index.wxss | 3.1 KB |
| pages/me/index.wxss | 3.1 KB |
| pages/income/index.wxss | 3.0 KB |
| pages/home/index.wxss | 2.8 KB |

## setData 调用密度

| 文件 | 次数 |
|---|---:|
| lib/shared/base.js | 41 |
| lib/shared/mixins/collection.js | 13 |
| lib/shared/mixins/craft.js | 13 |
| lib/shared/overrides.js | 13 |
| lib/shared/d4.js | 9 |
| lib/shared/d5.js | 9 |
| lib/shared/mixins/browse.js | 7 |
| lib/shared/mixins/poster.js | 7 |
| pages/cards/index.js | 3 |
| pages/categories/index.js | 3 |
| pages/home/index.js | 3 |
| pages/search/index.js | 3 |
| pages/set/index.js | 3 |
| components/navigation-bar/navigation-bar.js | 2 |
| pages/create/index.js | 2 |

## 结论

- 包体主体是 `assets/`、页面与 lib；`tools/docs/.github/server` 已不进入小程序包。
- 列表摘要 + 详情 hydrate 已减少列表数据量；feed/author/craft 已摘要化。
- 样式已分层/下沉，legacy CSS 仍有约 1010 行，需真机回归后继续归档。
- `setData` 次数仅作静态参考；真正的性能需开发者工具 Performance 面板验证。
