# 键盘星球 Typing Adventure

[![CI](https://github.com/kevinalliswell/typing-adventure/actions/workflows/ci.yml/badge.svg)](https://github.com/kevinalliswell/typing-adventure/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

给 6-8 岁孩子使用的英文 QWERTY 键盘练习游戏。课程按暑假 6 周设计：每天两次、每次约 20 分钟，共 84 次练习，目标是从认识 F/J 定位键开始，逐步熟悉全键盘、空格、Shift、标点和短句输入。

这是一个离线优先的浏览器应用，不需要账号、后端或远程媒体资源。

## 特性

- 42 天课程、每天 2 次练习、三档难度和弱键自适应复习。
- 五种轮换玩法：找星星、气球防线、小火车、密码门、火箭冲刺。
- 气球防线包含下落气球、键盘炮台、子弹拖尾、炮口闪光、命中爆炸和音效反馈。
- 屏幕键盘、键位熟练度、准确率、连续正确和星星积分反馈。
- 进度保存在浏览器本地；音效由 Web Audio 生成，配音使用浏览器内置语音能力。
- 原生 ES Modules + Vite，无运行时图片、字体、音频或统计服务请求。

## 快速开始

```bash
git clone https://github.com/kevinalliswell/typing-adventure.git
cd typing-adventure
npm ci
npm run dev
```

开发服务默认运行在 `http://localhost:5191`。打开浏览器后点击“开始今天的探险”即可开始。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动端口 `5191` 的开发服务 |
| `npm test` | 运行 Node.js 单元测试 |
| `npm run build` | 创建生产构建 |
| `npm run preview` | 预览生产构建 |
| `npm audit --audit-level=high` | 检查高危及以上依赖漏洞 |

## 项目结构

- `src/engine.js`：42 天课程、三档难度、按键统计和弱键自适应。
- `src/balloon-game.js`：气球生成、下落、子弹飞行、命中爆炸和状态清理。
- `src/storage.js`：本地进度读写与损坏数据防护。
- `src/audio.js`：Web Audio 发射/爆炸/输入音效和可选浏览器配音。
- `src/main.js`：页面状态、练习循环、动画反馈和键盘事件。
- `src/ui.js` / `src/styles.css`：儿童化“键盘星球”视觉系统、五种玩法和响应式布局。
- `test/`：课程、输入、本地存储、声音和气球玩法的单元测试。

课程细节见 [`docs/course-plan.md`](./docs/course-plan.md)：6 周、84 次练习，每天两次，每次约 20 分钟。

## 设计来源

本项目借鉴 [xiaolai/type-review](https://github.com/xiaolai/type-review) 的自适应字母解锁、弱键复习、按键统计和屏幕键盘思路，重新设计为面向儿童的离线练习游戏。上游项目使用 MIT License；本项目不复制其成人版 UI 和内容资源，相关实现来源会保留在项目说明中。

## 隐私

不需要账号，不上传输入内容，不使用统计服务。练习进度只保存在当前浏览器的本地存储中。

音效默认开启，配音默认关闭；两者都可以在首页或练习页单独切换。音效由浏览器本地生成，配音使用浏览器自带语音能力，不会请求远程音频文件。

## 贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读 [`CONTRIBUTING.md`](./CONTRIBUTING.md)，本地提交前至少运行 `npm test` 和 `npm run build`。

## 许可证

本项目使用 [MIT License](./LICENSE)。
