# Implementation Plan: 键盘星球 Typing Adventure

## Overview

Build a standalone, offline-first English QWERTY typing game for children aged 6-8. The app uses the open-source `xiaolai/type-review` project's adaptive lesson idea: letter mastery is measured per key, weak keys receive extra practice, and new keys unlock gradually. The product surface is redesigned as a colorful keyboard adventure with a six-week summer course, two 20-minute sessions per day, three difficulty levels, a visible on-screen keyboard, and local progress only.

## Architecture Decisions

- Use Vite + native ES modules in `typing-adventure/`; keep the existing root fruit game untouched.
- Keep course rules and adaptive scoring in pure `src/engine.js`; keep browser storage in `src/storage.js`; keep DOM orchestration in `src/main.js`.
- Use `localStorage` for the first version because the profile is small and local-only. Guard parsing and cap history so damaged storage cannot break startup.
- Use CSS/HTML shapes and motion for the child-friendly visual world; avoid runtime image/network dependencies so the practice app works offline after loading.
- Follow the upstream MIT license and document the inspiration in the project README.

## Course Design

- 42 daily lessons, 6 weeks, 84 sessions total, approximately 28 hours across the summer.
- Each day has a 5-minute warm-up and a 15-minute mission inside a 20-minute session target.
- Week 1: F/J anchors and home row. Week 2: top row. Week 3: bottom row. Week 4: mixed words and spaces. Week 5: Shift, punctuation and numbers. Week 6: short sentences, accuracy and celebration runs.
- `gentle`, `explorer`, and `rocket` difficulty presets adjust hints and accuracy goals without changing the child-facing lesson order.

## Verification Gates

- Pure engine tests cover lesson count, unlock order, adaptive weak-key focus, key-stat normalization and difficulty presets.
- Browser checks cover the start flow, keyboard input, correct/error feedback, pause/resume, session completion, progress persistence, responsive layout, accessibility names, and a clean console.
- Final checks: `npm test`, `npm run build`, and a real browser pass at mobile and desktop widths.

## Boundaries

- Always: keep the app playable without an account or network, keep typed content local, test new behavior, and preserve the existing root project.
- Ask first: adding external services, user accounts, multiplayer, cloud sync, or changing the root project's package/dependencies.
- Never: collect telemetry, ship secrets, require a remote font/image/audio service, or silently discard saved progress.
