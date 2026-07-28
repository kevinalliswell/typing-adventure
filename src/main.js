import {
  BADGES,
  DIFFICULTIES,
  MAX_SESSION_SECONDS,
  REST_SECONDS,
  SESSION_PLANS,
  buildStagePlan,
  choosePrompt,
  completeSession,
  getDailyPlan,
  getLesson,
  isCountedSession,
  isHintVisible,
  normalizeKey,
  recordKey,
} from "./engine.js";
import { createBalloonRound, shootBalloon, updateBalloonRound } from "./balloon-game.js";
import { isCorrectInput, isIgnoredKey, requiresShift } from "./input.js";
import { SoundBoard } from "./audio.js";
import {
  DEFAULT_PROFILE_NAME,
  PROFILE_AVATARS,
  addProfile,
  clearDraftData,
  ensureRoster,
  loadDraftData,
  loadProfileData,
  saveDraftData,
  saveProfileData,
  setActiveProfile,
} from "./storage.js";
import { formatTime, renderActivityStrip, renderBalloonArena, renderHome, renderKeyboard, renderPractice, renderProfiles, renderResult, renderTarget } from "./ui.js";
import "./styles.css";

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const app = document.querySelector("#app");
let roster = ensureRoster();
let activeProfileId = roster.activeId;
let profile = loadProfileData(activeProfileId);
let screen = "home";
let run = null;
let timerHandle = null;
let balloonFrameHandle = null;
let balloonLastFrame = 0;
const sound = new SoundBoard(profile.audio);

// 旧版本把草稿放在 sessionStorage，迁移后不再读取，顺手清掉。
try {
  sessionStorage.removeItem("typing-adventure:session-draft");
} catch {
  // 忽略存储不可用。
}

function activeExplorer() {
  return roster.profiles.find((entry) => entry.id === activeProfileId) ?? null;
}

function profileSummaries() {
  return roster.profiles.map((entry) => {
    const data = entry.id === activeProfileId ? profile : loadProfileData(entry.id);
    return {
      ...entry,
      completedDays: Math.floor(Math.min(data.completedSessions ?? 0, 84) / 2),
    };
  });
}

function getValidDraft() {
  const draft = loadDraftData(activeProfileId);
  if (!draft || draft.version !== 2 || Date.now() - Number(draft.savedAt) > DRAFT_MAX_AGE_MS) return null;
  return draft;
}

function describeDraft(draft) {
  if (!draft) return null;
  return {
    dayNumber: Math.min(42, Math.max(1, Number(draft.plan?.dayNumber) || 1)),
    sessionNumber: Math.min(2, Math.max(1, Number(draft.plan?.sessionNumber) || 1)),
  };
}

function render() {
  if (screen === "home") app.innerHTML = renderHome(profile, { explorer: activeExplorer(), draft: describeDraft(getValidDraft()) });
  if (screen === "profiles") app.innerHTML = renderProfiles(roster, profileSummaries());
  if (screen === "practice" && run) app.innerHTML = renderPractice(profile, run);
  if (screen === "result" && run?.result) {
    app.innerHTML = renderResult(profile, run.result);
    const actions = app.querySelector(".dialog-actions");
    if (actions && !actions.querySelector('[data-action="continue"]')) {
      const continueButton = document.createElement("button");
      continueButton.className = "primary-action";
      continueButton.type = "button";
      continueButton.dataset.action = "continue";
      continueButton.textContent = "继续下一站";
      actions.prepend(continueButton);
    }
  }
}

function focusCapture() {
  document.querySelector("#keyboard-capture")?.focus();
}

function currentStage() {
  return run?.stages[run.stageIndex];
}

function isBalloonActivity() {
  return run?.activity.id === "balloon-defense";
}

function nextPrompt() {
  const stage = currentStage();
  if (stage.type === "warmup") return stage.prompts[run.stageProgress % stage.prompts.length];
  return choosePrompt(run.lesson, profile, run.promptIndex, run.prompt);
}

function startBalloonMode() {
  if (!run || !isBalloonActivity() || run.resting || run.paused) return;
  const keys = run.lesson.activeKeys.filter((key) => /^[a-z]$/.test(key));
  run.balloonRound = createBalloonRound(keys, { targetHits: currentStage().target });
  balloonLastFrame = performance.now();
  updateBalloonView();
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function stopBalloonMode() {
  if (balloonFrameHandle !== null) window.cancelAnimationFrame(balloonFrameHandle);
  balloonFrameHandle = null;
  balloonLastFrame = 0;
  if (run) run.balloonRound = null;
}

function balloonFrame(now) {
  if (!run || screen !== "practice" || run.paused || run.resting || !isBalloonActivity()) {
    balloonFrameHandle = null;
    return;
  }
  const elapsed = Math.min(0.12, Math.max(0, (now - balloonLastFrame) / 1000));
  balloonLastFrame = now;
  const previousMisses = run.balloonRound.misses;
  run.balloonRound = updateBalloonRound(run.balloonRound, elapsed);
  const missedNow = run.balloonRound.misses - previousMisses;
  if (missedNow > 0) {
    run.score = Math.max(0, run.score - 5 * missedNow);
    run.lastFeedback = "wrong";
    run.feedbackText = "有气球落地了，星星 −5";
    run.announcement = "气球落地，扣 5 颗星星";
    sound.wrong();
    updatePracticeView();
  }
  updateBalloonView();
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function updateBalloonView() {
  const arena = document.querySelector("#balloon-arena");
  if (!arena || !run?.balloonRound) return;
  const remaining = Math.max(0, currentStage().target - run.stageProgress);
  arena.innerHTML = renderBalloonArena(run.balloonRound, { remaining });
}

function createRun(plan, { countsTowardProgress = true } = {}) {
  const sessionPlanId = Object.hasOwn(SESSION_PLANS, profile.sessionPlanId) ? profile.sessionPlanId : "standard";
  const stages = buildStagePlan(plan.lesson, sessionPlanId, profile);
  return {
    plan,
    originalPlan: {
      dayNumber: plan.dayNumber,
      sessionNumber: plan.sessionNumber,
    },
    countsTowardProgress,
    lesson: plan.lesson,
    difficultyId: profile.difficultyId,
    sessionPlanId,
    stages,
    stageIndex: 0,
    stageProgress: 0,
    completedStages: 0,
    resting: false,
    restRemaining: 0,
    activity: stages[0].activity,
    stageMeta: { cars: 0, altitude: 0 },
    currentErrors: 0,
    promptHadError: false,
    prompt: stages[0].prompts[0],
    promptIndex: 0,
    typed: "",
    correct: 0,
    errors: 0,
    total: 0,
    streak: 0,
    score: 0,
    elapsedSeconds: 0,
    lastFeedback: "ready",
    feedbackText: "先热热身，唤醒小手",
    lastPressed: "",
    announcement: `${plan.lesson.title}，第 ${plan.sessionNumber} 次练习开始，先热身`,
    paused: false,
  };
}

function startPractice(planOverride = null, options = {}) {
  clearTimer();
  clearDraft();
  sound.update(profile.audio);
  sound.unlock();
  const plan = planOverride ?? getDailyPlan(profile);
  run = createRun(plan, options);
  screen = "practice";
  render();
  focusCapture();
  sound.station();
  sound.speak(`第 ${plan.dayNumber} 天，${plan.lesson.title}，先热身`);
  saveDraft();
  timerHandle = window.setInterval(tick, 1000);
}

function tick() {
  if (!run || run.paused || screen !== "practice") return;
  if (run.resting) {
    run.restRemaining = Math.max(0, run.restRemaining - 1);
    setText("#rest-countdown", String(run.restRemaining));
    if (run.restRemaining <= 0) {
      endRest();
      return;
    }
    saveDraft();
    return;
  }
  run.elapsedSeconds += 1;
  const timer = document.querySelector("#timer-value");
  if (timer) timer.textContent = formatTime(run.elapsedSeconds);
  saveDraft();
  if (run.elapsedSeconds >= MAX_SESSION_SECONDS) finishPractice({ allowEmpty: true });
}

function updatePracticeView() {
  if (!run || screen !== "practice") return;
  const stage = currentStage();
  const expected = run.prompt[run.typed.length] ?? "";
  const balloonActive = isBalloonActivity();
  const accuracy = run.total === 0 ? "--" : `${Math.round((run.correct / run.total) * 100)}%`;
  const targetPanel = document.querySelector("#typing-target-panel");
  const arena = document.querySelector("#balloon-arena");
  if (targetPanel) targetPanel.hidden = balloonActive;
  if (arena) arena.hidden = !balloonActive;
  if (balloonActive) updateBalloonView();
  const maskFrom = run.activity.id === "code-lock" ? Math.ceil(run.prompt.length / 2) : Infinity;
  const target = document.querySelector("#target-sequence");
  if (target) target.innerHTML = renderTarget(run.prompt, run.typed, run.lastFeedback, maskFrom);
  const strip = document.querySelector("#activity-strip");
  if (strip) strip.innerHTML = renderActivityStrip(run);
  const hintVisible = isHintVisible(DIFFICULTIES[run.difficultyId], stage.type, run.currentErrors);
  const keyboard = document.querySelector("#keyboard-container");
  if (keyboard) keyboard.innerHTML = renderKeyboard(run.lesson, profile, balloonActive || !hintVisible ? "" : expected, run.lastPressed);
  setText("#accuracy-value", accuracy);
  setText("#streak-value", `${run.streak} 次`);
  setText("#score-value", String(run.score));
  setText("#target-chip", balloonActive ? "发射" : normalizeKey(expected) === "space" ? "space" : expected || "完成");
  setText("#keyboard-note", balloonActive
    ? "按字母键发射能量弹"
    : stage.type === "warmup"
      ? "热身：跟着亮起来的键就好"
      : hintVisible ? "目标键会亮起来" : "先自己找找，需要时提示会出现");
  setText("#feedback-line", run.feedbackText);
  const activityBanner = document.querySelector("#activity-banner");
  if (activityBanner) activityBanner.className = `activity-banner activity-banner--${run.activity.id}`;
  setText("#activity-icon", run.activity.icon);
  setText("#activity-title", run.activity.title);
  setText("#activity-hint", run.activity.hint);
  setText("#activity-count", `本关 ${run.stageProgress} / ${stage.target}`);
  setText("#stage-pill", `第 ${run.stageIndex + 1} / ${run.stages.length} 关`);
  const feedback = document.querySelector("#feedback-line");
  if (feedback) feedback.className = `feedback-line feedback-line--${run.lastFeedback}`;
  const finish = document.querySelector('[data-action="finish"]');
  if (finish) finish.disabled = run.total === 0;
  const fill = document.querySelector("#track-fill");
  const planet = document.querySelector("#track-planet");
  const fraction = Math.min(1, (run.completedStages + Math.min(1, run.stageProgress / stage.target)) / run.stages.length);
  setText("#track-label", `${run.completedStages} / ${run.stages.length} 关`);
  if (fill) fill.style.width = `${fraction * 100}%`;
  if (planet) planet.style.left = `${Math.min(94, 4 + fraction * 90)}%`;
  setText("#screen-announcer", run.announcement);
  run.lastPressed = "";
  saveDraft();
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function acceptKey(event) {
  if (screen === "profiles" && event.key === "Enter" && event.target?.id === "new-profile-name") {
    createNewProfile();
    return;
  }
  if (!run || screen !== "practice" || run.paused || run.resting) return;
  if (isBalloonActivity()) {
    handleBalloonInput(event);
    return;
  }
  if (event.metaKey || event.ctrlKey || event.altKey || isIgnoredKey(event.key)) return;
  const expected = run.prompt[run.typed.length];
  if (!expected) return;
  const actual = event.key;
  const expectedIsUppercase = requiresShift(expected);
  const isCorrect = isCorrectInput(expected, actual);
  const expectedKey = normalizeKey(expected);
  if (!expectedKey) return;
  event.preventDefault();
  run.total += 1;
  profile = recordKey(profile, expectedKey, isCorrect);
  if (expectedIsUppercase) profile = recordKey(profile, "shift", isCorrect);
  run.lastPressed = normalizeKey(actual);
  if (isCorrect) {
    sound.correct();
    run.typed += expected;
    run.correct += 1;
    run.streak += 1;
    run.score += 10 + Math.min(20, run.streak);
    run.currentErrors = 0;
    run.lastFeedback = "correct";
    run.feedbackText = run.streak >= 5 ? "连成一条星河！" : "漂亮！继续前进";
    run.announcement = "正确";
    if (run.activity.id === "word-train") {
      run.stageMeta.cars = Math.min(12, run.stageMeta.cars + 1);
      run.feedbackText = `火车挂上第 ${run.stageMeta.cars} 节车厢`;
    }
    if (run.activity.id === "rocket-dash") run.stageMeta.altitude += 1;
    if (run.typed.length >= run.prompt.length) {
      finishPrompt();
      return;
    }
  } else {
    sound.wrong();
    run.errors += 1;
    run.currentErrors += 1;
    run.promptHadError = true;
    if (currentStage().type !== "warmup") run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = `再找找：${expected === " " ? "space" : expected}`;
    run.announcement = "再试一次";
    if (run.activity.id === "word-train" && run.stageMeta.cars > 0) {
      run.stageMeta.cars -= 1;
      run.feedbackText = "哎呀，一节车厢掉了，稳住再挂上";
    }
  }
  updatePracticeView();
}

function finishPrompt() {
  run.stageProgress += 1;
  run.promptIndex += 1;
  run.typed = "";
  run.currentErrors = 0;
  if (run.activity.id === "rocket-dash" && !run.promptHadError) {
    run.score += 10;
    run.feedbackText = "完美冲刺！火箭加速 +10";
  } else if (run.activity.id === "code-lock") {
    run.feedbackText = "咔哒！这扇密码门开了";
  } else {
    run.feedbackText = "星语通过，下一条来了";
  }
  run.promptHadError = false;
  if (run.stageProgress >= currentStage().target) {
    completeStage();
    return;
  }
  run.prompt = nextPrompt();
  run.announcement = "星语通过";
  sound.station();
  updatePracticeView();
}

function completeStage() {
  const finishedStage = currentStage();
  if (finishedStage.activity.id === "word-train" && run.stageMeta.cars >= 8) {
    run.score += 20;
    run.feedbackText = `火车满载 ${run.stageMeta.cars} 节车厢，奖励 +20`;
  }
  run.completedStages += 1;
  run.stageProgress = 0;
  run.typed = "";
  run.stageMeta = { cars: 0, altitude: 0 };
  run.currentErrors = 0;
  run.promptHadError = false;
  if (finishedStage.type === "balloon") stopBalloonMode();
  if (run.completedStages >= run.stages.length) {
    finishPractice({ allowEmpty: true });
    return;
  }
  run.stageIndex += 1;
  const stage = currentStage();
  run.activity = stage.activity;
  run.prompt = nextPrompt();
  run.lastFeedback = "correct";
  sound.complete();
  if (run.completedStages % 2 === 0) {
    startRest();
    return;
  }
  run.feedbackText = `小关完成！下一关：${stage.activity.title}`;
  run.announcement = `第 ${run.completedStages} 关完成，进入${stage.activity.title}`;
  sound.speak(`${stage.activity.title}，${stage.activity.hint}`);
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  saveDraft();
}

function startRest() {
  run.resting = true;
  run.restRemaining = REST_SECONDS;
  run.feedbackText = "小关完成！休息一下";
  run.announcement = `第 ${run.completedStages} 关完成，休息 ${REST_SECONDS} 秒`;
  sound.speak("伸伸小手，休息一下");
  render();
  document.querySelector('[data-action="skip-rest"]')?.focus();
  saveDraft();
}

function endRest() {
  if (!run || !run.resting) return;
  run.resting = false;
  run.restRemaining = 0;
  const stage = currentStage();
  run.feedbackText = `继续出发！这一关：${stage.activity.title}`;
  run.announcement = `休息结束，进入${stage.activity.title}`;
  sound.station();
  sound.speak(`${stage.activity.title}，${stage.activity.hint}`);
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  saveDraft();
}

function handleBalloonInput(event) {
  if (!run || !run.balloonRound || event.metaKey || event.ctrlKey || event.altKey || isIgnoredKey(event.key)) return;
  const key = normalizeKey(event.key);
  if (!/^[a-z]$/.test(key) || run.balloonRound.balloons.length === 0) return;
  event.preventDefault();
  const result = shootBalloon(run.balloonRound, key);
  run.lastPressed = key;
  run.total += 1;
  profile = recordKey(profile, key, result.shot);
  if (result.shot) {
    run.balloonRound = result.round;
    run.correct += 1;
    run.streak += 1;
    run.score += 15;
    run.lastFeedback = "correct";
    run.feedbackText = "命中！气球爆开了";
    run.announcement = "命中气球";
    sound.launch();
    sound.explode();
    run.stageProgress += 1;
    if (run.stageProgress >= currentStage().target) {
      completeStage();
      return;
    }
  } else {
    run.errors += 1;
    run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = "这颗字母没有气球，再瞄准看看";
    run.announcement = "没有命中，再试一次";
    sound.wrong();
  }
  updatePracticeView();
}

function pausePractice() {
  if (!run || screen !== "practice" || run.paused || run.resting) return;
  run.paused = true;
  stopBalloonMode();
  run.announcement = "练习已暂停";
  saveDraft();
  render();
  document.querySelector('[data-action="resume"]')?.focus();
}

function resumePractice() {
  if (!run || screen !== "practice" || !run.paused) return;
  run.paused = false;
  run.lastFeedback = "ready";
  run.feedbackText = "星语继续前进";
  if (isBalloonActivity()) startBalloonMode();
  sound.station();
  sound.speak("继续飞行");
  render();
  focusCapture();
  saveDraft();
}

function persistProfile() {
  saveProfileData(activeProfileId, profile);
}

function recordRunToProfile() {
  profile = completeSession(profile, {
    accuracy: run.total === 0 ? 0 : run.correct / run.total,
    elapsedSeconds: run.elapsedSeconds,
    completedAt: new Date().toISOString(),
    completedStages: run.completedStages,
    totalStages: run.stages.length,
    score: run.score,
  });
  persistProfile();
}

function finishPractice({ allowEmpty = false } = {}) {
  if (!run || screen !== "practice" || (!allowEmpty && run.total === 0)) return;
  clearTimer();
  stopBalloonMode();
  clearDraft();
  const accuracy = run.total === 0 ? 0 : run.correct / run.total;
  const totalStages = run.stages.length;
  const counted = run.total > 0 && isCountedSession(run.completedStages, totalStages);
  const metTarget = counted && accuracy >= DIFFICULTIES[run.difficultyId].targetAccuracy;
  const previousBadges = profile.badges ?? {};
  const previousBest = profile.bestScore ?? 0;
  if (run.countsTowardProgress && run.total > 0) recordRunToProfile();
  else persistProfile();
  const newBadges = Object.keys(profile.badges ?? {})
    .filter((id) => !previousBadges[id])
    .map((id) => BADGES.find((badge) => badge.id === id))
    .filter(Boolean)
    .map((badge) => ({ icon: badge.icon, title: badge.title, description: badge.description }));
  sound.complete();
  sound.speak(run.total === 0
    ? "本次还没有输入，可以重新开始"
    : counted
      ? metTarget ? "漂亮的降落" : "探险完成"
      : "热身完成，下次接着飞");
  run.result = {
    accuracy,
    score: run.score,
    correct: run.correct,
    errors: run.errors,
    empty: run.total === 0,
    counted,
    metTarget,
    completedStages: run.completedStages,
    totalStages,
    elapsedSeconds: run.elapsedSeconds,
    totalStars: profile.totalStars ?? 0,
    bestScore: profile.bestScore ?? 0,
    isNewBest: counted && run.score > 0 && run.score > previousBest,
    newBadges,
    originalPlan: run.originalPlan,
  };
  run.resting = false;
  screen = "result";
  render();
  document.querySelector('[data-action="continue"]')?.focus();
}

function retryCompletedSession() {
  if (!run?.result?.originalPlan) return;
  const { dayNumber, sessionNumber } = run.result.originalPlan;
  startPractice({
    dayNumber,
    sessionNumber,
    totalSessions: 84,
    lesson: getLesson(dayNumber),
  }, { countsTowardProgress: false });
}

function continueToNextSession() {
  startPractice();
}

function clearTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
}

function hasMeaningfulProgress() {
  return Boolean(run && (run.total > 0 || run.elapsedSeconds > 10));
}

function goHome({ force = false } = {}) {
  if (!force && screen === "practice" && hasMeaningfulProgress()) {
    const willRecord = run.countsTowardProgress && run.total > 0;
    const message = willRecord
      ? "要提前结束这次探险吗？已完成的小关和练习时间会被记录。"
      : "本次探险还没有完成。确定退出并放弃当前进度吗？";
    if (!window.confirm(message)) {
      focusCapture();
      return;
    }
    if (willRecord) recordRunToProfile();
    else persistProfile();
  }
  clearTimer();
  stopBalloonMode();
  clearDraft();
  screen = "home";
  run = null;
  render();
}

function openProfiles() {
  if (screen === "practice") return;
  screen = "profiles";
  run = null;
  render();
  document.querySelector("#new-profile-name")?.focus();
}

function selectProfile(id) {
  if (!roster.profiles.some((entry) => entry.id === id)) return;
  persistProfile();
  roster = setActiveProfile(roster, id);
  activeProfileId = id;
  profile = loadProfileData(id);
  sound.update(profile.audio);
  screen = "home";
  run = null;
  render();
}

function createNewProfile() {
  const input = document.querySelector("#new-profile-name");
  const name = input?.value?.trim() || DEFAULT_PROFILE_NAME;
  const avatar = document.querySelector(".avatar-option.is-selected")?.dataset.avatar || PROFILE_AVATARS[0];
  const result = addProfile(roster, { name, avatar });
  if (!result.profile) return;
  persistProfile();
  roster = result.roster;
  activeProfileId = result.profile.id;
  profile = loadProfileData(activeProfileId);
  sound.update(profile.audio);
  screen = "home";
  render();
  sound.speak(`${result.profile.name}，欢迎来到键盘星球`);
}

function chooseAvatar(target) {
  if (!target) return;
  document.querySelectorAll(".avatar-option").forEach((element) => {
    element.classList.remove("is-selected");
    element.setAttribute("aria-pressed", "false");
  });
  target.classList.add("is-selected");
  target.setAttribute("aria-pressed", "true");
  document.querySelector("#new-profile-name")?.focus();
}

function updateDifficulty(id) {
  if (!Object.hasOwn(DIFFICULTIES, id)) return;
  profile = { ...profile, difficultyId: id };
  persistProfile();
  render();
  document.querySelector(`[data-difficulty="${id}"]`)?.focus();
}

function updateSessionPlan(id) {
  if (!Object.hasOwn(SESSION_PLANS, id)) return;
  profile = { ...profile, sessionPlanId: id };
  persistProfile();
  render();
  document.querySelector(`[data-plan="${id}"]`)?.focus();
}

function toggleAudioSetting(setting) {
  const audio = { ...profile.audio, [setting]: !profile.audio[setting] };
  profile = { ...profile, audio };
  sound.update(audio);
  persistProfile();
  if (audio[setting]) {
    sound.unlock();
    if (setting === "voiceEnabled") sound.speak("配音已打开");
    else sound.correct();
  } else if (setting === "voiceEnabled") {
    sound.stopVoice();
  }
  render();
  if (screen === "practice") focusCapture();
}

// 每次落盘同时保存草稿和档案：中断时按键统计也不丢失。
function saveDraft() {
  if (!run || screen !== "practice") return;
  saveDraftData(activeProfileId, {
    version: 2,
    savedAt: Date.now(),
    plan: run.originalPlan,
    countsTowardProgress: run.countsTowardProgress,
    state: {
      difficultyId: run.difficultyId,
      sessionPlanId: run.sessionPlanId,
      stageIndex: run.stageIndex,
      stageProgress: run.stageProgress,
      completedStages: run.completedStages,
      prompt: run.prompt,
      promptIndex: run.promptIndex,
      typed: run.typed,
      correct: run.correct,
      errors: run.errors,
      total: run.total,
      streak: run.streak,
      score: run.score,
      elapsedSeconds: run.elapsedSeconds,
      lastFeedback: run.lastFeedback,
      feedbackText: run.feedbackText,
      announcement: run.announcement,
    },
  });
  persistProfile();
}

function clearDraft() {
  clearDraftData(activeProfileId);
}

function resumeDraft() {
  const draft = getValidDraft();
  if (!draft) {
    render();
    return;
  }
  clearTimer();
  const dayNumber = Math.min(42, Math.max(1, Number(draft.plan?.dayNumber) || 1));
  const sessionNumber = Math.min(2, Math.max(1, Number(draft.plan?.sessionNumber) || 1));
  const lesson = getLesson(dayNumber);
  const plan = { dayNumber, sessionNumber, totalSessions: 84, lesson };
  const state = draft.state ?? {};
  const sessionPlanId = Object.hasOwn(SESSION_PLANS, state.sessionPlanId) ? state.sessionPlanId : profile.sessionPlanId;
  const stages = buildStagePlan(lesson, sessionPlanId, profile);
  const stageIndex = Math.min(stages.length - 1, Math.max(0, Math.floor(Number(state.stageIndex) || 0)));
  const stage = stages[stageIndex];
  const stageProgress = Math.min(stage.target - 1, Math.max(0, Math.floor(Number(state.stageProgress) || 0)));
  const completedStages = Math.min(stageIndex, Math.max(0, Math.floor(Number(state.completedStages) || 0)));
  const fallbackPrompt = stage.type === "warmup"
    ? stage.prompts[stageProgress % stage.prompts.length]
    : choosePrompt(lesson, profile, Math.max(0, Number(state.promptIndex) || 0));
  const prompt = typeof state.prompt === "string" && state.prompt ? state.prompt : fallbackPrompt;
  const typed = typeof state.typed === "string" && state.typed.length < prompt.length ? state.typed : "";
  sound.update(profile.audio);
  sound.unlock();
  run = {
    plan,
    originalPlan: { dayNumber, sessionNumber },
    countsTowardProgress: Boolean(draft.countsTowardProgress),
    lesson,
    difficultyId: Object.hasOwn(DIFFICULTIES, state.difficultyId) ? state.difficultyId : profile.difficultyId,
    sessionPlanId,
    stages,
    stageIndex,
    stageProgress,
    completedStages,
    resting: false,
    restRemaining: 0,
    activity: stage.activity,
    stageMeta: { cars: 0, altitude: 0 },
    currentErrors: 0,
    promptHadError: false,
    prompt,
    promptIndex: Math.max(0, Number(state.promptIndex) || 0),
    typed,
    correct: Math.max(0, Number(state.correct) || 0),
    errors: Math.max(0, Number(state.errors) || 0),
    total: Math.max(0, Number(state.total) || 0),
    streak: Math.max(0, Number(state.streak) || 0),
    score: Math.max(0, Number(state.score) || 0),
    elapsedSeconds: Math.min(MAX_SESSION_SECONDS, Math.max(0, Number(state.elapsedSeconds) || 0)),
    lastFeedback: typeof state.lastFeedback === "string" ? state.lastFeedback : "ready",
    feedbackText: "接着上次的进度继续飞",
    lastPressed: "",
    announcement: "继续未完成的探险",
    paused: false,
  };
  screen = "practice";
  render();
  focusCapture();
  if (isBalloonActivity()) startBalloonMode();
  sound.station();
  sound.speak("欢迎回来，继续飞行");
  timerHandle = window.setInterval(tick, 1000);
  saveDraft();
}

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "start") startPractice();
  if (action === "resume-draft") resumeDraft();
  if (action === "pause") pausePractice();
  if (action === "resume") resumePractice();
  if (action === "skip-rest") endRest();
  if (action === "finish") finishPractice();
  if (action === "home") goHome();
  if (action === "retry") retryCompletedSession();
  if (action === "continue") continueToNextSession();
  if (action === "switch-profile") openProfiles();
  if (action === "profiles-back") {
    screen = "home";
    render();
  }
  if (action === "select-profile") selectProfile(event.target.closest("[data-id]")?.dataset.id);
  if (action === "create-profile") createNewProfile();
  if (action === "avatar-option") chooseAvatar(event.target.closest(".avatar-option"));
  if (action === "difficulty") updateDifficulty(event.target.closest("[data-difficulty]").dataset.difficulty);
  if (action === "session-plan") updateSessionPlan(event.target.closest("[data-plan]").dataset.plan);
  if (action === "toggle-effects") toggleAudioSetting("effectsEnabled");
  if (action === "toggle-voice") toggleAudioSetting("voiceEnabled");
});

window.addEventListener("keydown", acceptKey);
window.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "practice" && run && !run.paused && !run.resting) pausePractice();
});
window.addEventListener("beforeunload", (event) => {
  if (screen === "practice" && hasMeaningfulProgress()) {
    saveDraft();
    event.preventDefault();
    event.returnValue = "";
  }
});

render();
