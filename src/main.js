import {
  DIFFICULTIES,
  SESSION_SECONDS,
  choosePrompt,
  completeSession,
  getDailyPlan,
  getActivityForPrompt,
  normalizeKey,
  recordKey,
} from "./engine.js";
import { createBalloonRound, shootBalloon, updateBalloonRound } from "./balloon-game.js";
import { isCorrectInput, isIgnoredKey, requiresShift } from "./input.js";
import { SoundBoard } from "./audio.js";
import { loadProfile, saveProfile } from "./storage.js";
import { formatTime, renderBalloonArena, renderHome, renderKeyboard, renderPractice, renderResult, renderTarget } from "./ui.js";
import "./styles.css";

const app = document.querySelector("#app");
let profile = loadProfile();
let screen = "home";
let run = null;
let timerHandle = null;
let balloonFrameHandle = null;
let balloonLastFrame = 0;
const sound = new SoundBoard(profile.audio);

function render() {
  if (screen === "home") app.innerHTML = renderHome(profile);
  if (screen === "practice" && run) app.innerHTML = renderPractice(profile, run);
  if (screen === "result" && run?.result) app.innerHTML = renderResult(profile, run.result);
}

function focusCapture() {
  document.querySelector("#keyboard-capture")?.focus();
}

function isBalloonActivity() {
  return run?.activity.id === "balloon-defense";
}

function startBalloonMode() {
  if (!run || !isBalloonActivity()) return;
  const keys = run.lesson.activeKeys.filter((key) => /^[a-z]$/.test(key));
  run.balloonRound = createBalloonRound(keys);
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
  if (!run || screen !== "practice" || run.paused || !isBalloonActivity()) {
    balloonFrameHandle = null;
    return;
  }
  const elapsed = Math.min(0.12, Math.max(0, (now - balloonLastFrame) / 1000));
  balloonLastFrame = now;
  run.balloonRound = updateBalloonRound(run.balloonRound, elapsed);
  updateBalloonView();
  balloonFrameHandle = window.requestAnimationFrame(balloonFrame);
}

function updateBalloonView() {
  const arena = document.querySelector("#balloon-arena");
  if (arena && run?.balloonRound) arena.innerHTML = renderBalloonArena(run.balloonRound);
}

function setActivity(nextActivity) {
  if (!run || run.activity.id === nextActivity.id) return;
  const wasBalloon = isBalloonActivity();
  run.activity = nextActivity;
  if (nextActivity.id === "balloon-defense") startBalloonMode();
  else if (wasBalloon) stopBalloonMode();
}

function startPractice() {
  clearTimer();
  sound.update(profile.audio);
  sound.unlock();
  const plan = getDailyPlan(profile);
  run = {
    plan,
    lesson: plan.lesson,
    difficultyId: profile.difficultyId,
    prompt: choosePrompt(plan.lesson, profile, 0),
    promptIndex: 0,
    activity: getActivityForPrompt(0),
    completedPrompts: 0,
    typed: "",
    correct: 0,
    errors: 0,
    total: 0,
    streak: 0,
    score: 0,
    remainingSeconds: SESSION_SECONDS,
    lastFeedback: "ready",
    feedbackText: "星语已经准备好",
    lastPressed: "",
    announcement: `${plan.lesson.title}，第 ${plan.sessionNumber} 次练习开始`,
    paused: false,
  };
  screen = "practice";
  render();
  focusCapture();
  sound.station();
  sound.speak(`第 ${plan.dayNumber} 天，${plan.lesson.title}`);
  timerHandle = window.setInterval(tick, 1000);
}

function tick() {
  if (!run || run.paused || screen !== "practice") return;
  run.remainingSeconds = Math.max(0, run.remainingSeconds - 1);
  const timer = document.querySelector("#timer-value");
  if (timer) timer.textContent = formatTime(run.remainingSeconds);
  if (run.remainingSeconds <= 0) finishPractice({ allowEmpty: true });
}

function updatePracticeView() {
  if (!run || screen !== "practice") return;
  const expected = run.prompt[run.typed.length] ?? "";
  const balloonActive = isBalloonActivity();
  const accuracy = run.total === 0 ? "--" : `${Math.round((run.correct / run.total) * 100)}%`;
  const targetPanel = document.querySelector("#typing-target-panel");
  const arena = document.querySelector("#balloon-arena");
  if (targetPanel) targetPanel.hidden = balloonActive;
  if (arena) arena.hidden = !balloonActive;
  if (balloonActive) updateBalloonView();
  const target = document.querySelector("#target-sequence");
  if (target) target.innerHTML = renderTarget(run.prompt, run.typed, run.lastFeedback);
  const keyboard = document.querySelector("#keyboard-container");
  if (keyboard) keyboard.innerHTML = renderKeyboard(run.lesson, profile, balloonActive ? "" : expected, run.lastPressed);
  setText("#accuracy-value", accuracy);
  setText("#streak-value", `${run.streak} 次`);
  setText("#score-value", String(run.score));
  setText("#target-chip", balloonActive ? "发射" : normalizeKey(expected) === "space" ? "space" : expected || "完成");
  setText("#keyboard-note", balloonActive ? "按字母键发射能量弹" : DIFFICULTIES[run.difficultyId].hints ? "目标键会亮起来" : "跟着目标，自己寻找");
  setText("#feedback-line", run.feedbackText);
  const activityBanner = document.querySelector("#activity-banner");
  if (activityBanner) activityBanner.className = `activity-banner activity-banner--${run.activity.id}`;
  setText("#activity-icon", run.activity.icon);
  setText("#activity-title", run.activity.title);
  setText("#activity-hint", run.activity.hint);
  setText("#activity-count", `第 ${run.completedPrompts + 1} 站`);
  const feedback = document.querySelector("#feedback-line");
  if (feedback) feedback.className = `feedback-line feedback-line--${run.lastFeedback}`;
  const finish = document.querySelector('[data-action="finish"]');
  if (finish) finish.disabled = run.total === 0;
  const fill = document.querySelector("#track-fill");
  const planet = document.querySelector("#track-planet");
  setText("#track-label", `${run.completedPrompts} / 6 小站`);
  const percent = Math.min(100, (run.completedPrompts / 6) * 100);
  if (fill) fill.style.width = `${percent}%`;
  if (planet) planet.style.left = `${Math.min(94, 4 + (run.completedPrompts / 6) * 90)}%`;
  setText("#screen-announcer", run.announcement);
  run.lastPressed = "";
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function acceptKey(event) {
  if (!run || screen !== "practice" || run.paused) return;
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
    run.lastFeedback = "correct";
    run.feedbackText = run.streak >= 5 ? "连成一条星河！" : "漂亮！继续前进";
    if (run.typed.length >= run.prompt.length) {
      run.completedPrompts += 1;
      run.promptIndex += 1;
      setActivity(getActivityForPrompt(run.completedPrompts));
      run.prompt = choosePrompt(run.lesson, profile, run.promptIndex);
      run.typed = "";
      run.feedbackText = run.completedPrompts % 4 === 0 ? "小站到站，伸伸小手再出发" : "小站通过，下一种玩法在前面";
      run.announcement = `${run.activity.title}，${run.activity.hint}`;
      sound.station();
      if (run.completedPrompts % 4 === 0) sound.speak("小站到站，伸伸小手再出发");
      else if (run.completedPrompts % 3 === 0) sound.speak(`${run.activity.title}，${run.activity.hint}`);
    }
  } else {
    sound.wrong();
    run.errors += 1;
    run.streak = 0;
    run.lastFeedback = "wrong";
    run.feedbackText = `再找找：${expected === " " ? "space" : expected}`;
  }
  run.announcement = run.lastFeedback === "correct" ? "正确" : "再试一次";
  updatePracticeView();
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
    run.completedPrompts += 1;
    run.promptIndex += 1;
    run.prompt = choosePrompt(run.lesson, profile, run.promptIndex);
    run.correct += 1;
    run.streak += 1;
    run.score += 15;
    run.lastFeedback = "correct";
    run.feedbackText = "命中！气球爆开了";
    setActivity(getActivityForPrompt(run.completedPrompts));
    sound.launch();
    sound.explode();
    sound.station();
    if (run.completedPrompts % 4 === 0) sound.speak("小站到站，伸伸小手再出发");
    else if (run.completedPrompts % 3 === 0) sound.speak(`${run.activity.title}，${run.activity.hint}`);
    run.announcement = "命中气球";
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
  if (!run || screen !== "practice" || run.paused) return;
  run.paused = true;
  stopBalloonMode();
  run.announcement = "练习已暂停";
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
}

function finishPractice({ allowEmpty = false } = {}) {
  if (!run || screen !== "practice" || (!allowEmpty && run.total === 0)) return;
  clearTimer();
  stopBalloonMode();
  const accuracy = run.total === 0 ? 0 : run.correct / run.total;
  profile = completeSession(profile, {
    accuracy,
    elapsedSeconds: SESSION_SECONDS - run.remainingSeconds,
    completedAt: new Date().toISOString(),
  });
  saveProfile(profile);
  sound.complete();
  sound.speak(run.total === 0 ? "本次还没有输入，可以重新开始" : accuracy >= 0.92 ? "漂亮的降落" : "探险完成");
  run.result = {
    accuracy,
    score: run.score,
    correct: run.correct,
    errors: run.errors,
    empty: run.total === 0,
  };
  screen = "result";
  render();
  document.querySelector('[data-action="home"]')?.focus();
}

function clearTimer() {
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = null;
}

function goHome() {
  clearTimer();
  stopBalloonMode();
  screen = "home";
  run = null;
  render();
}

function updateDifficulty(id) {
  if (!Object.hasOwn(DIFFICULTIES, id)) return;
  profile = { ...profile, difficultyId: id };
  saveProfile(profile);
  render();
  document.querySelector(`[data-difficulty="${id}"]`)?.focus();
}

function toggleAudioSetting(setting) {
  const audio = { ...profile.audio, [setting]: !profile.audio[setting] };
  profile = { ...profile, audio };
  sound.update(audio);
  saveProfile(profile);
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

app.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (!action) return;
  if (action === "start") startPractice();
  if (action === "pause") pausePractice();
  if (action === "resume") resumePractice();
  if (action === "finish") finishPractice();
  if (action === "home") goHome();
  if (action === "retry") startPractice();
  if (action === "difficulty") updateDifficulty(event.target.closest("[data-difficulty]").dataset.difficulty);
  if (action === "toggle-effects") toggleAudioSetting("effectsEnabled");
  if (action === "toggle-voice") toggleAudioSetting("voiceEnabled");
});

window.addEventListener("keydown", acceptKey);
window.addEventListener("visibilitychange", () => {
  if (document.hidden && screen === "practice" && run && !run.paused) pausePractice();
});

render();