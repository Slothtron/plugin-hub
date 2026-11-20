# openviking-memory — ZCode 插件

OpenViking 长期语义记忆的 ZCode 插件化打包,由上游
[OpenViking](https://github.com/volcengine/OpenViking) `examples/agent-hook-plugin`
的官方 ZCode 适配(`hosts/zcode/`)装配而成。**本插件是
[plugin-hub](../../README.md) 的一员**,同步与版本策略见 hub README。

## 组成

```
.zcode-plugin/  hooks/  .mcp.json  commands/     # 自写 overlay(ZCode 化 manifests)
scripts/with-user-config.mjs                     # 自写:配置防火墙 + UI 桥接
skills/                                          # 自写 ov-memory-doctor + 上游 4 技能
upstream/                                        # 上游纯镜像,勿手改,由 sync 脚本整块覆盖
  agent-hook-plugin/     ← examples/agent-hook-plugin
  memory-plugin-shared/  ← examples/memory-plugin-shared
```

overlay 与 upstream 的唯一契约:三个脚本路径
`upstream/agent-hook-plugin/scripts/{hook,uri-guard}.mjs`、`servers/mcp-proxy.mjs`
(`scripts/verify-paths.mjs` 校验)。

## 与上游集成安装方式的差异

上游 `install.sh --harness zcode` 直接改写 `~/.zcode/hooks.json` / `~/.zcode/mcp.json`
(Unix only);插件化后配置随插件装/卸,支持 Windows。hook 事件集合与脚本行为与
上游 ZCode 适配一致:`SessionStart`(profile + `<available-skills>` 注入)、
`UserPromptSubmit`(语义召回)、`PreToolUse: Read|Glob|Grep`(`viking://` URI 守卫)、
`Stop`(增量 turn 捕获与提交,ZCode 无 PreCompact/SessionEnd,以 Stop 提交替代)。
manifest 层把上游 `type:"command"` 字符串命令改写为 ZCode 的 `type:"process"` +
`args` 数组 + `${ZCODE_PLUGIN_ROOT}`,全部经 `scripts/with-user-config.mjs` 中转。

## 配置源:只有 UI 与内置默认

插件只接受两个配置源,**环境变量与 `ovcli.conf`/`ov.conf` 一律不读**:

1. **插件 UI**(Settings → Plugins → OpenViking Memory):server URL / API key /
   account / user 四项。hooks 与 MCP 同源:hooks 经 `with-user-config.mjs`
   (`ZCODE_USER_CONFIG_*` → `OPENVIKING_*`),MCP 经 `${user_config.*}` 插值到
   同样的 `ZCODE_USER_CONFIG_*` 名字,再由同一桥接裁决。
2. **内置默认**:`http://127.0.0.1:1933`,无鉴权(UI 留空即用)。

桥接同时是防火墙:启动目标前清光外部 `OPENVIKING_*` 连接变量(只留 hook
事件/来源/版本/debug 四个内部标记),并钉 `OPENVIKING_CREDENTIAL_SOURCE=env`
使运行时按设计跳过两个配置文件层。工作区 `.openviking/config.json` 不受影响——
运行时本就拒绝其中的连接/凭据键。注意:桥接里 `process.argv[1]` 会被指向目标
脚本,因为 mcp-proxy/doctor 以 `argv[1] === import.meta.url` 判直跑。

## 诊断

`/openviking-memory:ov-status` 命令,或直接:

```bash
node "${ZCODE_PLUGIN_ROOT}/upstream/agent-hook-plugin/scripts/ov-memory-doctor.mjs" zcode
```

doctor 输出仍会提及文件层(它面向上游通用安装);对本插件那些层永远不生效。
