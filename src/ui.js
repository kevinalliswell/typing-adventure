import { DIFFICULTIES, KEY_ROWS, getCourseProgress, getDailyPlan, getMastery, normalizeKey } from "./engine.js";
import { requiresShift } from "./input.js";
import { BALLOON_EXPLOSION_SECONDS, BALLOON_FIELD_HEIGHT, PROJECTILE_FLIGHT_SECONDS } from "./balloon-game.js";
import { SESSION_GATES, getSessionProgress, shouldShowTargetHint } from "./session.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function renderBrand() {
  return `<div class="brand-lockup">
    <div class="brand-orbit" aria-hidden="true"><span>✦</span></div>
    <div><strong>键盘星球</strong><span>Typing Adventure</span></div>
  </div>`;
}

function renderAudioControls(profile) {
  const audio = profile.audio ?? { effectsEnabled: true, voiceEnabled: false };
  return `<div class="audio-controls" aria-label="声音设置">
    <button class="audio-toggle ${audio.effectsEnabled ? "is-on" : ""}" type="button" data-action="toggle-effects" aria-pressed="${audio.effectsEnabled}" aria-label="${audio.effectsEnabled ? "关闭音效" : "开启音效"}" title="${audio.effectsEnabled ? "关闭音效" : "开启音效"}">♫</button>
    <button class="audio-toggle ${audio.voiceEnabled ? "is-on" : ""}" type="button" data-action="toggle-voice" aria-pressed="${audio.voiceEnabled}" aria-label="${audio.voiceEnabled ? "关闭配音" : "开启配音"}" title="${audio.voiceEnabled ? "关闭配音" : "开启配音"}">声</button>
  </div>`;
}

function renderPlanet() {
  return `<div class="planet-scene" aria-hidden="true">
    <span class="star star--one">✦</span><span class="star star--two">·</span><span class="star star--three">✦</span>
    <div class="planet"><span class="planet-face">◡</span></div>
    <div class="rocket-illustration"><span class="rocket-window"></span><i></i></div>
    <span class="planet-label">F · J</span>
  </div>`;
}

function renderDifficulty(profile) {
  return Object.values(DIFFICULTIES).map((difficulty) => `
    <button class="difficulty-choice ${profile.difficultyId === difficulty.id ? "is-selected" : ""}" type="button" data-action="difficulty" data-difficulty="${difficulty.id}" aria-pressed="${profile.difficultyId === difficulty.id}">
      <span class="difficulty-dot difficulty-dot--${difficulty.id}" aria-hidden="true"></span>
      <span class="difficulty-copy"><strong>${difficulty.name} · ${Math.round(difficulty.targetAccuracy * 100)}%</strong><small>${difficulty.description}</small></span>
      <span class="difficulty-mark" aria-hidden="true">${profile.difficultyId === difficulty.id ? "✓" : ""}</span>
    </button>`).join("");
}

function renderWeekMap(profile) {
  const progress = getCourseProgress(profile);
  return Array.from({ length: 6 }, (_, index) => {
    const week = index + 1;
    const start = index * 14;
    const done = Math.max(0, Math.min(14, progress.completedSessions - start));
    const status = done >= 14 ? "done" : done > 0 ? "current" : "locked";
    const labels = ["定位星", "上排云", "下排谷", "单词环", "符号站", "星光港"];
    return `<div class="week-node week-node--${status}" aria-label="第${week}周 ${labels[index]}，完成 ${done} / 14 次">
      <span class="week-node__number">${status === "done" ? "✓" : week}</span>
      <span class="week-node__label">${labels[index]}</span>
      <span class="week-node__count">${done}/14</span>
    </div>`;
  }).join("");
}

export function renderHome(profile) {
  const plan = getDailyPlan(profile);
  const progress = getCourseProgress(profile);
  const difficulty = DIFFICULTIES[profile.difficultyId];
  return `<main class="app-shell home-shell">
    <header class="topbar topbar--home">${renderBrand()}<div class="topbar-tools">${renderAudioControls(profile)}<div class="privacy-chip"><span aria-hidden="true">●</span> 本地保存</div></div></header>
    <section class="home-hero page-width">
      <div class="hero-copy">
        <p class="eyebrow">第 ${plan.dayNumber} 天 · 第 ${plan.sessionNumber} 次探险</p>
        <h1>准备好，<em>小小键盘星探</em>！</h1>
        <p class="hero-story">今天去 <strong>${escapeHtml(plan.lesson.title)}</strong>，让每一颗键位星星都找到自己的位置。</p>
        <button class="primary-action" type="button" data-action="start"><span aria-hidden="true">▶</span> 开始今天的探险</button>
      </div>
      ${renderPlanet()}
    </section>
    <section class="dashboard-grid page-width" aria-label="今日课程">
      <article class="mission-card">
        <div class="card-heading"><div><p class="eyebrow">TODAY'S MISSION</p><h2>今天的任务</h2></div><span class="day-badge">DAY ${plan.dayNumber}</span></div>
        <div class="mission-main"><div class="mission-icon" aria-hidden="true">✦</div><div><h3>${escapeHtml(plan.lesson.title)}</h3><p>${escapeHtml(plan.lesson.story)}</p></div></div>
        <div class="mission-facts"><span><strong>3</strong> 关进阶</span><span><strong>10</strong> 个小站</span><span><strong>5</strong> 种玩法</span></div>
        <div class="gate-preview" aria-label="本次闯关顺序">${SESSION_GATES.map((gate) => `<span><b>${gate.icon}</b>${gate.name}</span>`).join("")}</div>
      </article>
      <article class="progress-card">
        <div class="card-heading"><div><p class="eyebrow">SUMMER JOURNEY</p><h2>暑假探险地图</h2></div><strong class="progress-percent">${progress.percent}%</strong></div>
        <div class="progress-bar" aria-label="课程进度 ${progress.percent}%"><span style="width: ${progress.percent}%"></span></div>
        <div class="week-map">${renderWeekMap(profile)}</div>
        <p class="muted-note">已完成 ${progress.completedDays} / ${progress.totalDays} 天 · 每天两次，稳稳进步</p>
      </article>
    </section>
    <section class="settings-section page-width" aria-labelledby="difficulty-title">
      <div class="section-heading"><div><p class="eyebrow">CHOOSE YOUR FLIGHT</p><h2 id="difficulty-title">选择飞行模式</h2></div><span class="selected-mode">当前：${difficulty.shortName}</span></div>
      <div class="difficulty-grid">${renderDifficulty(profile)}</div>
    </section>
    <footer class="site-footer page-width"><span>键盘星球 · 6 周成长航线</span><span>不需要账号，进度只在这台设备上</span></footer>
  </main>`;
}

export function renderTarget(prompt, typed, lastFeedback) {
  return [...prompt].map((character, index) => {
    const isDone = index < typed.length;
    const isCurrent = index === typed.length;
    const classNames = ["target-char"];
    if (isDone) classNames.push("is-done");
    if (isCurrent) classNames.push("is-current");
    if (isCurrent && lastFeedback === "wrong") classNames.push("is-wrong");
    const display = character === " " ? "·" : character;
    return `<span class="${classNames.join(" ")}" data-char-index="${index}">${escapeHtml(display)}</span>`;
  }).join("");
}

function keyLabel(key) {
  if (key === "1") return "1 !";
  if (key === "/") return "/ ?";
  if (key === "space") return "space";
  return key;
}

function keyAriaLabel(key) {
  if (key === "1") return "数字 1 和感叹号";
  if (key === "/") return "斜杠和问号";
  return keyLabel(key);
}

function renderKey(key, expected, activeKeys, profile, lastPressed) {
  const mastery = getMastery(profile, key);
  const normalizedExpected = normalizeKey(expected);
  const classes = ["keyboard-key"];
  if (activeKeys.includes(key)) classes.push("is-active");
  if (key === normalizedExpected) classes.push("is-target");
  if (key === "shift" && requiresShift(expected)) classes.push("is-target");
  if (key === lastPressed) classes.push("is-pressed");
  const masteryPercent = Math.round(mastery * 100);
  return `<span class="${classes.join(" ")}" data-key="${escapeHtml(key)}" style="--mastery: ${masteryPercent}%" aria-label="${escapeHtml(keyAriaLabel(key))}，熟练度 ${masteryPercent}%">${escapeHtml(keyLabel(key))}</span>`;
}

export function renderKeyboard(lesson, profile, expected, lastPressed = "") {
  const rows = [
    { keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], className: "keyboard-row--numbers" },
    { keys: KEY_ROWS.top, className: "keyboard-row--top" },
    { keys: KEY_ROWS.home, className: "keyboard-row--home" },
    { keys: KEY_ROWS.bottom, className: "keyboard-row--bottom" },
  ];
  return `<div class="keyboard-layout" aria-label="屏幕键盘">
    ${rows.map((row) => `<div class="keyboard-row ${row.className}">${row.keys.map((key) => renderKey(key, expected, lesson.activeKeys, profile, lastPressed)).join("")}</div>`).join("")}
    <div class="keyboard-row keyboard-row--special">${renderKey("shift", expected, lesson.activeKeys, profile, lastPressed)}${renderKey("space", expected, lesson.activeKeys, profile, lastPressed)}</div>
  </div>`;
}

export function renderBalloonArena(round) {
  const safeRound = round ?? {
    balloons: [],
    hits: 0,
    misses: 0,
    score: 0,
    shotFlash: 0,
    height: BALLOON_FIELD_HEIGHT,
  };
  const sparkAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const balloons = safeRound.balloons.map((balloon) => {
    const isExploding = balloon.state === "exploding";
    const remaining = Number(balloon.explodeIn) || 0;
    const explosionProgress = isExploding
      ? Math.min(1, Math.max(0, (PROJECTILE_FLIGHT_SECONDS + BALLOON_EXPLOSION_SECONDS - remaining) / BALLOON_EXPLOSION_SECONDS))
      : 0;
    const sparks = sparkAngles.map((angle) => {
      const distance = 7 + explosionProgress * 22;
      const scale = 0.75 + explosionProgress * 0.45;
      return `<i style="transform: rotate(${angle}deg) translateY(-${distance}px) scale(${scale})"></i>`;
    }).join("");
    const classes = ["falling-balloon", `falling-balloon--${balloon.id % 4}`];
    if (isExploding) classes.push("is-exploding");
    return `<span class="${classes.join(" ")}" style="left: ${balloon.x}%; top: ${balloon.y}px; --explosion-scale: ${1 + explosionProgress * 0.65}; --explosion-opacity: ${1 - explosionProgress}" aria-label="气球字母 ${escapeHtml(balloon.key.toUpperCase())}${isExploding ? "，正在爆炸" : ""}"><b>${escapeHtml(balloon.key.toUpperCase())}</b><i></i>${isExploding ? `<span class="balloon-explosion" aria-hidden="true">${sparks}</span>` : ""}</span>`;
  }).join("");
  const projectiles = (safeRound.projectiles ?? []).map((projectile) => `<span class="energy-projectile" style="left: ${projectile.x}%; top: ${projectile.y}px" aria-hidden="true"><i></i></span>`).join("");
  return `<div class="balloon-field" style="--field-height: ${safeRound.height}px" role="img" aria-label="气球防线：击落 ${safeRound.hits} 个，漏掉 ${safeRound.misses} 个">
    <div class="balloon-cloud balloon-cloud--one" aria-hidden="true"></div><div class="balloon-cloud balloon-cloud--two" aria-hidden="true"></div>
    <div class="balloon-field__title"><span>气球防线</span><small>按字母发射能量弹</small></div>
    <div class="balloon-field__stats"><span>击落 <strong>${safeRound.hits}</strong></span><span>漏掉 <strong>${safeRound.misses}</strong></span><span>星星 <strong>${safeRound.score}</strong></span></div>
    <div class="balloon-layer">${balloons}</div>
    <div class="projectile-layer">${projectiles}</div>
    <div class="launcher ${safeRound.shotFlash > 0 ? "is-firing" : ""}" aria-hidden="true"><span class="launcher-muzzle"></span><span class="launcher-bolt">✦</span><div class="launcher-barrel"></div><div class="launcher-base"><span>键盘炮台</span></div></div>
    <span class="balloon-ground" aria-hidden="true"></span>
  </div>`;
}

export function renderActivityScene(activity, run) {
  const activityId = activity?.id ?? "star-scout";
  const stationInActivity = (run?.completedPrompts ?? 0) % 2;
  if (activityId === "word-train") {
    return `<div class="activity-scene train-scene" id="activity-scene" aria-hidden="true"><span class="train-engine">➜</span><span class="train-car ${stationInActivity >= 1 ? "is-filled" : ""}">1</span><span class="train-car">2</span></div>`;
  }
  if (activityId === "code-lock") {
    return `<div class="activity-scene code-scene" id="activity-scene" aria-hidden="true"><span class="code-lock">⌁</span><span class="code-light is-on"></span><span class="code-light ${stationInActivity >= 1 ? "is-on" : ""}"></span></div>`;
  }
  if (activityId === "rocket-dash") {
    const fuel = Math.min(100, (run?.streak ?? 0) * 8);
    return `<div class="activity-scene rocket-scene" id="activity-scene" aria-hidden="true"><span class="dash-rocket">↗</span><span class="rocket-fuel"><i style="width: ${fuel}%"></i></span></div>`;
  }
  return `<div class="activity-scene star-scene" id="activity-scene" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span><span>✦</span></div>`;
}

function renderGateProgress(run, difficulty) {
  const progress = getSessionProgress(run, difficulty);
  return `<section class="gate-progress" aria-label="三关进度">
    <div class="gate-progress__heading"><span>当前关卡</span><strong id="gate-name">${progress.complete ? "三关完成" : progress.gate.name}</strong></div>
    <div class="gate-steps">${SESSION_GATES.map((gate, index) => {
      const status = index < run.completedGates ? "done" : index === progress.gateIndex ? "current" : "locked";
      return `<span class="gate-step gate-step--${status}"><b>${status === "done" ? "✓" : gate.icon}</b><small>${gate.name}</small></span>`;
    }).join("")}</div>
    <div class="gate-requirements">
      <span>正确键 <strong id="gate-correct">${run.correct} / ${progress.gate.minCorrect}</strong></span>
      <span>准确率 <strong id="gate-accuracy">${Math.round(progress.accuracy * 100)}% / ${Math.round(progress.targetAccuracy * 100)}%</strong></span>
      <span>小站 <strong id="gate-stations">${run.completedPrompts} / ${progress.gate.minStations}</strong></span>
    </div>
  </section>`;
}

export function renderPractice(profile, run) {
  const difficulty = DIFFICULTIES[run.difficultyId];
  const progress = getSessionProgress(run, difficulty);
  const showTargetHint = shouldShowTargetHint(difficulty, progress.gateIndex, run.consecutiveErrors);
  const expected = run.prompt[run.typed.length] ?? "";
  const balloonActive = run.activity.id === "balloon-defense";
  const accuracy = run.total === 0 ? "--" : `${Math.round((run.correct / run.total) * 100)}%`;
  return `<main class="app-shell practice-shell ${run.paused ? "is-paused" : ""}" data-feedback="${run.lastFeedback}">
    <header class="topbar topbar--practice page-width">
      <button class="icon-action" type="button" data-action="home" aria-label="返回课程首页" title="返回课程首页">←</button>
      ${renderBrand()}
      ${renderAudioControls(profile)}
      <div class="practice-header-stats"><span class="mode-label">${difficulty.shortName}</span><span class="timer-pill" id="timer-value" aria-label="本次练习剩余时间">${formatTime(run.remainingSeconds)}</span></div>
      <button class="icon-action" type="button" data-action="pause" aria-label="暂停练习" title="暂停练习">Ⅱ</button>
    </header>
    <div class="practice-layout page-width">
      <section class="lesson-column" aria-labelledby="practice-title">
        <div class="lesson-overline"><span>DAY ${run.plan.dayNumber} / 42</span><span>SESSION ${run.plan.sessionNumber} / 2</span></div>
        <div class="lesson-title-row"><div><p class="eyebrow">${escapeHtml(run.lesson.phase)}</p><h1 id="practice-title">${escapeHtml(run.lesson.title)}</h1></div><span class="mission-star" aria-hidden="true">✦</span></div>
        <p class="lesson-story">${escapeHtml(run.lesson.story)}</p>
        ${renderGateProgress(run, difficulty)}
        <div class="activity-banner activity-banner--${run.activity.id}" id="activity-banner" aria-live="polite"><span class="activity-banner__icon" id="activity-icon" aria-hidden="true">${escapeHtml(run.activity.icon)}</span><div><span class="activity-banner__label">当前玩法</span><strong id="activity-title">${escapeHtml(run.activity.title)}</strong><p id="activity-hint">${escapeHtml(run.activity.hint)}</p></div><span class="activity-banner__count" id="activity-count">第 ${run.completedPrompts + 1} 站</span></div>
        <div class="flight-track" aria-label="本次任务进度"><span class="track-line"></span><span class="track-fill" id="track-fill" style="width: ${Math.min(100, (run.completedPrompts / 10) * 100)}%"></span><span class="track-planet" id="track-planet" style="left: ${Math.min(94, 4 + (run.completedPrompts / 10) * 90)}%">✦</span><span class="track-label" id="track-label">${run.completedPrompts} / 10 小站</span></div>
        <div class="target-panel activity-stage activity-stage--${run.activity.id}" id="typing-target-panel" ${balloonActive ? "hidden" : ""}>${renderActivityScene(run.activity, run)}<span class="target-label">当前星语</span><div class="target-sequence" id="target-sequence" aria-label="目标文字">${renderTarget(run.prompt, run.typed, run.lastFeedback)}</div><span class="target-caption">目标中的 · 代表空格</span><input id="keyboard-capture" class="keyboard-capture" aria-label="键盘练习输入区" autocomplete="off" autocapitalize="off" spellcheck="false" /></div>
        <div id="balloon-arena" ${balloonActive ? "" : "hidden"}>${renderBalloonArena(run.balloonRound)}</div>
        <div class="feedback-line feedback-line--${run.lastFeedback}" id="feedback-line" role="status">${escapeHtml(run.feedbackText)}</div>
        <div class="live-stats" aria-label="本次练习统计"><div><span>准确率</span><strong id="accuracy-value">${accuracy}</strong></div><div><span>连续正确</span><strong id="streak-value">${run.streak}<small> 次</small></strong></div><div><span>星星</span><strong id="score-value">${run.score}</strong></div></div>
        <button class="finish-action" type="button" data-action="finish" ${run.total === 0 ? "disabled" : ""}>结束并保存本次练习</button>
        <p class="finish-note">完成三关会自动结算；提前结束不会推进课程。</p>
      </section>
      <aside class="keyboard-column" aria-labelledby="keyboard-title"><div class="keyboard-heading"><div><p class="eyebrow">YOUR NAVIGATOR</p><h2 id="keyboard-title">小手导航</h2></div><span class="target-chip" id="target-chip">${balloonActive ? "发射" : showTargetHint ? escapeHtml(keyLabel(normalizeKey(expected))) : "自己找"}</span></div><p class="keyboard-note" id="keyboard-note">${balloonActive ? "按字母键发射能量弹" : showTargetHint ? "目标键会亮起来" : "这一关不亮键，连续出错后会提示"}</p><div id="keyboard-container">${renderKeyboard(run.lesson, profile, balloonActive || !showTargetHint ? "" : expected, run.lastPressed)}</div><div class="finger-legend"><span><i class="legend-dot legend-dot--mint"></i>已经认识</span><span><i class="legend-dot legend-dot--yellow"></i>当前目标</span></div></aside>
    </div>
    <div id="pause-layer">${run.paused ? renderPauseLayer() : ""}</div>
    <div class="sr-only" aria-live="polite" id="screen-announcer">${escapeHtml(run.announcement)}</div>
  </main>`;
}

function renderPauseLayer() {
  return `<div class="modal-backdrop"><section class="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><span class="pause-orbit" aria-hidden="true">Ⅱ</span><p class="eyebrow">FLIGHT PAUSED</p><h2 id="pause-title">休息一下</h2><p>小手放松，准备好再继续。</p><div class="dialog-actions"><button class="primary-action" type="button" data-action="resume">继续飞行</button><button class="secondary-action" type="button" data-action="home">回到首页</button></div></section></div>`;
}

export function renderResult(profile, result) {
  const nextPlan = getDailyPlan(profile);
  const accuracy = Math.round(result.accuracy * 100);
  const completed = result.completed === true;
  const message = completed
    ? "三关完成！准确、耐心和节奏都收进了星光。"
    : result.timedOut ? "时间到了，本次练习已保存；下次从同一课次继续挑战。" : "本次练习已保存，休息好再来完成三关。";
  const status = completed
    ? `<div class="next-mission"><span class="next-icon" aria-hidden="true">✦</span><div><span>下一站</span><strong>第 ${nextPlan.dayNumber} 天 · 第 ${nextPlan.sessionNumber} 次 · ${escapeHtml(nextPlan.lesson.title)}</strong></div></div>`
    : `<div class="next-mission next-mission--incomplete"><span class="next-icon" aria-hidden="true">↺</span><div><span>本次状态</span><strong>课程进度没有推进，键位练习数据已经保存</strong></div></div>`;
  const continueAction = completed ? `<button class="primary-action" type="button" data-action="continue">继续下一站</button>` : "";
  return `<main class="app-shell result-shell result-shell--${completed ? "complete" : "incomplete"}"><header class="topbar topbar--home">${renderBrand()}<div class="topbar-tools">${renderAudioControls(profile)}<div class="privacy-chip"><span aria-hidden="true">●</span> ${completed ? "正式进度已保存" : "练习数据已保存"}</div></div></header><section class="result-content page-width"><div class="result-burst" aria-hidden="true"><span>✦</span><span>✦</span><span>✦</span><div>${completed ? "★" : "↺"}</div></div><p class="eyebrow">${completed ? "MISSION COMPLETE" : "PRACTICE SAVED"}</p><h1>${completed ? "三关完成，漂亮降落！" : "本次练习已保存"}</h1><p class="result-message">${message}</p><div class="result-score-grid"><div><strong>${accuracy}%</strong><span>准确率</span></div><div><strong>${result.score}</strong><span>收集星星</span></div><div><strong>${result.correct}</strong><span>正确键</span></div></div>${status}<div class="dialog-actions">${continueAction}<button class="secondary-action" type="button" data-action="retry">${completed ? "再飞一次" : "继续本课次"}</button><button class="secondary-action" type="button" data-action="home">回到课程地图</button></div></section></main>`;
}
