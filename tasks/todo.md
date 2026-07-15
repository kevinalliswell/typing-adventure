# Task Checklist

## Task 1: 失败测试定义规则

- [x] 三关累计阈值、最终准确率和提示降级测试先失败。
- [x] 未通关结果不得推进正式课次测试先失败。
- [x] G/H、标点物理键和显式课程解锁测试先失败。
- Verify: `npm test`

## Task 2: 纯规则与课程修复

- [x] 新增 `src/session.js` 并让规则测试通过。
- [x] 修正提前 A/Z/Shift、Shift 标点映射和五玩法轮换。
- [x] `completeSession` 只接受明确完成的结果。
- Verify: `npm test && npm run build`

## Task 3: 主循环接入

- [x] 三关达成后自动正式结算；提前结束和超时不推进。
- [x] 难度提示按关卡和连续错误实际变化。
- [x] 气球漏掉计入错误与弱键统计。
- Verify: `npm test`

## Task 4: 儿童 UI 与五玩法

- [x] 三关进度和剩余目标清晰可见。
- [x] 五种玩法在一次闯关内出现并有不同画面/反馈。
- [x] 屏幕键盘完整，辅助文字可读，按钮键盘操作不误记输入。
- Verify: `npm test && npm run build`，真实浏览器桌面与移动检查。

## Task 5: E2E 与文档

- [x] Playwright 固定为 devDependency 并提供 `npm run test:e2e`。
- [x] 关键完成、重练、下一站、课程键位和难度 E2E 通过。
- [x] README、课程计划、changelog 与实现一致。
- Verify: `npm test && npm run test:e2e && npm run build`

## Task 6: 完成审计

- [x] `npm audit --audit-level=high` 通过。
- [x] 浏览器控制台无错误/警告，320/768/1024/1440px 可用。
- [x] 逐项核对 `docs/progressive-session-spec.md` 成功条件。
- [x] 自审无未处理 Required/Critical 问题，工作区变更均在预期范围。
