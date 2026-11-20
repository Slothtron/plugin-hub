# plugin-hub

自建 ZCode 插件库。现含一个插件;`plugins/` 布局为多插件扩展而设计。

## 为什么只有 ZCode 的 OpenViking 插件

OpenViking 官方对三家宿主的分发渠道不同:dsh 走 Desktop 插件页(公开包
`@openviking/dsh-memory-plugin`)、pi 走扩展目录、**ZCode 只有 Unix 脚本安装**
(`install.sh --harness zcode`,直接改写宿主配置文件,不支持 Windows)。本库把
ZCode 适配插件化,补上 Windows / marketplace 这条分发路径;dsh 与 pi 用官方渠道。

## 布局

```
marketplace.json                                  # ZCode 本地测试市场(dev-myclaw-plugins)
plugins/openviking-memory/                        # 插件(overlay + upstream 镜像)
  .zcode-plugin/ hooks/ .mcp.json commands/       #   自写 overlay(ZCode 化 manifests 等)
  scripts/with-user-config.mjs                    #   自写:配置防火墙(UI 或默认,env/ov.conf 不读)
  skills/                                         #   自写 doctor 技能 + 上游技能
  upstream/                                       #   上游纯镜像(同步脚本整块覆盖,勿手改)
    agent-hook-plugin/                            #     ← examples/agent-hook-plugin
    memory-plugin-shared/                         #     ← examples/memory-plugin-shared
scripts/sync-upstream.mjs                         # 同步:重镜像两棵树 + 版本映射
scripts/verify-paths.mjs                          # 结构校验(overlay↔upstream 契约)
.github/workflows/sync-openviking-upstream.yml    # 每日定时自动同步
```

overlay 与 upstream 的唯一契约是三个脚本路径(`upstream/agent-hook-plugin/scripts/
{hook,uri-guard}.mjs`、`servers/mcp-proxy.mjs`),由 `verify-paths.mjs` 把关。

## 同步上游

手动(本地有 OpenViking 检出):

```bash
node scripts/sync-upstream.mjs <path-to-OpenViking-checkout>   # 要求干净工作树
node scripts/verify-paths.mjs
node --test plugins/openviking-memory/upstream/agent-hook-plugin/tests/zcode*.test.mjs
```

自动:GitHub Actions 每日 03:17 UTC 对比上游与镜像的**内容哈希**(非版本号,防
overlay-only 发版与上游 patch 号碰撞导致漏同步),有变化才镜像 → 校验 → 跑上游
zcode 测试套件 → 提交推送。也可 workflow_dispatch 手动指定 ref。

- 版本策略:上游 `0.5.31` → hub `1.6.31`(major/minor 各 +1,patch 保留);overlay
  迭代递增 patch,下次同步会被上游号覆盖——更新由内容哈希触发,不依赖版本比较。
- `zcode-async.test.mjs` 排除:detached worker 超时,CI 与本机同样红,上游自身亦然。

## 本地安装(UI)

Plugin Marketplace → Add → 粘贴本仓库目录 → Personal → `dev-myclaw-plugins` →
OpenViking Memory → Install。连接配置在 Settings → Plugins 里填(UI 或内置默认
`http://127.0.0.1:1933`,env 与 ov.conf 一律不读)。
