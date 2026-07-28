export const COURSE_DAYS = 42;
export const SESSIONS_PER_DAY = 2;
export const MAX_SESSION_SECONDS = 60 * 60;
export const REST_SECONDS = 30;
export const HISTORY_LIMIT = 120;

export const SESSION_PLANS = Object.freeze({
  short: Object.freeze({ id: "short", name: "轻量飞行", minutes: 10, stages: 3 }),
  standard: Object.freeze({ id: "standard", name: "标准飞行", minutes: 15, stages: 4 }),
  full: Object.freeze({ id: "full", name: "完整飞行", minutes: 20, stages: 6 }),
});

export const DIFFICULTIES = Object.freeze({
  gentle: Object.freeze({
    id: "gentle",
    name: "轻松起步",
    shortName: "轻松",
    description: "提示一直在身边，先把手指放稳",
    targetAccuracy: 0.86,
    hints: true,
    hintAfterErrors: 0,
  }),
  explorer: Object.freeze({
    id: "explorer",
    name: "小小探险家",
    shortName: "探险",
    description: "提示会慢慢变少，准确又快",
    targetAccuracy: 0.92,
    hints: true,
    hintAfterErrors: 1,
  }),
  rocket: Object.freeze({
    id: "rocket",
    name: "键盘火箭手",
    shortName: "火箭",
    description: "挑战连续准确输入，冲向新星",
    targetAccuracy: 0.96,
    hints: false,
    hintAfterErrors: 3,
  }),
});

// 目标键提示的显示规则：热身关常亮；其余小关错满 hintAfterErrors 次后出现。
// gentle 的阈值是 0，等价于一直显示。
export function isHintVisible(difficulty, stageType, currentErrors = 0) {
  if (stageType === "warmup") return true;
  const threshold = Math.max(0, Math.floor(Number(difficulty?.hintAfterErrors) || 0));
  return Math.max(0, Number(currentErrors) || 0) >= threshold;
}

export const ACTIVITIES = Object.freeze([
  Object.freeze({ id: "star-scout", title: "找星星", icon: "✦", hint: "先找到亮起来的键" }),
  Object.freeze({ id: "balloon-defense", title: "气球防线", icon: "◉", hint: "按字母发射能量弹" }),
  Object.freeze({ id: "word-train", title: "小火车", icon: "➜", hint: "把一串键位连起来" }),
  Object.freeze({ id: "code-lock", title: "密码门", icon: "⌁", hint: "按对密码，门就打开" }),
  Object.freeze({ id: "rocket-dash", title: "火箭冲刺", icon: "↗", hint: "准确地冲过这一小站" }),
]);

export const WARMUP_ACTIVITY = Object.freeze({
  id: "warmup",
  title: "热身站",
  icon: "☼",
  hint: "轻轻唤醒小手，找到今天的键",
});

export const STAGE_TARGETS = Object.freeze({ warmup: 3, typing: 3, balloon: 8 });

const HOME_ROW = ["a", "s", "d", "f", "j", "k", "l", ";"];
const TOP_ROW = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
const BOTTOM_ROW = ["z", "x", "c", "v", "b", "n", "m"];

const LESSON_SPECS = [
  ["anchor", "找到 F 和 J", "在键盘星球找到两颗定位星", ["f", "j"], ["fj", "jf", "fjf", "jfj"]],
  ["anchor", "手指回家", "让 F 和 J 变成小手的家", ["d", "k"], ["fd", "jk", "dj", "kf", "fjd"]],
  ["home-row", "左右邻居", "认识 D 和 K 的左右邻居", ["s", "l"], ["ask", "fall", "sad", "lad", "flask"]],
  ["home-row", "小手伸展", "A 和分号让小手伸展开", ["a", ";"], ["a;", "sad", "lad", "all", "ask"]],
  ["home-row", "中间的 G 和 H", "两只手一起出发", ["g", "h"], ["had", "hash", "flag", "glass", "half"]],
  ["home-row", "回家路线", "沿着 ASDF 和 JKL; 回家", [], ["asdf", "jkl;", "sad", "fall", "ask", "had"]],
  ["home-row", "家排小队", "家排键位集结完毕", [], ["a", "sad", "fall", "hall", "ask", "flag", "glass"]],
  ["top-row", "E 和 I", "两颗新星从上方升起", ["e", "i"], ["die", "fill", "hide", "like", "life"]],
  ["top-row", "R 和 U", "小火箭学会向上飞", ["r", "u"], ["run", "rush", "fur", "rule", "drum"]],
  ["top-row", "W 和 O", "遇见 W 和 O 两颗星", ["w", "o"], ["wow", "wood", "word", "work", "how"]],
  ["top-row", "Q 和 P", "地图的两端也能找到", ["q", "p"], ["pop", "quip", "quiz", "pipe", "pup"]],
  ["top-row", "T 和 Y", "穿过 T Y 星云", ["t", "y"], ["try", "type", "tiny", "stay", "story"]],
  ["top-row", "上排混合", "让上排星星排成队", [], ["type", "write", "quiet", "power", "quite", "tower"]],
  ["top-row", "上排单词路", "沿着上排单词路前进", [], ["purple", "pretty", "quiet", "yeti", "water", "pilot"]],
  ["bottom-row", "C 和 M", "下方的 C M 月亮升起", ["c", "m"], ["come", "camp", "milk", "music", "map"]],
  ["bottom-row", "V 和 N", "穿过 V N 山谷", ["v", "n"], ["van", "even", "seven", "navy", "never"]],
  ["bottom-row", "B 小行星", "B 是一个圆滚滚的小行星", ["b"], ["baby", "blue", "boat", "build", "bobby"]],
  ["bottom-row", "X 和 Z", "找到最下面的 X Z", ["x", "z"], ["zoo", "zero", "box", "six", "mix"]],
  ["bottom-row", "下排混合", "让下排键位一起跳舞", [], ["box", "van", "mix", "zoo", "cave", "moon"]],
  ["alphabet", "全键盘初见", "所有字母星星都亮起来", [], ["jump", "quick", "brown", "fox", "lazy", "dog"]],
  ["alphabet", "字母寻宝", "在字母地图中找到宝藏", [], ["amazing", "brave", "explorer", "keyboard", "planet"]],
  ["words", "单词小路", "把字母连成一条小路", [], ["cat", "dog", "sun", "moon", "star", "tree"]],
  ["words", "动物朋友", "和小动物一起练习", [], ["cat", "dog", "fish", "bird", "horse", "rabbit"]],
  ["words", "颜色星球", "用颜色单词点亮星球", [], ["red", "blue", "green", "yellow", "orange", "pink"]],
  ["words", "数字小队", "认识简单的英文数字", [], ["one", "two", "three", "four", "five", "six"]],
  ["words", "我的小故事", "把喜欢的词语连起来", [], ["I", "like", "my", "big", "red", "ball"]],
  ["words", "词语加速", "准确地跑完单词赛道", [], ["play", "read", "draw", "jump", "sing", "learn"]],
  ["words", "短词挑战", "短词也要稳稳输入", [], ["look", "book", "fish", "ship", "tree", "blue"]],
  ["space", "空格桥", "空格是单词之间的桥", ["space"], ["I like", "my cat", "red ball", "big dog"]],
  ["shift", "大写能量", "按住 Shift 点亮大写字母", ["shift"], ["I Am", "My Dog", "Big Sun", "We Play"]],
  ["punctuation", "句号站", "一句话要在句号停下", ["."], ["I am happy.", "We can play.", "My cat is big."]],
  ["punctuation", "逗号风筝", "逗号让词语排排队", [","], ["red, blue", "one, two", "I run, I jump."]],
  ["punctuation", "问号月亮", "学会向朋友提问", ["?"], ["Are you ok?", "Do you play?", "Is it big?"]],
  ["punctuation", "感叹星", "用感叹号表达开心", ["!"], ["Wow!", "Great job!", "I can type!"]],
  ["numbers", "数字 1 2", "数字火箭开始倒数", ["1", "2"], ["1 star", "2 cats", "1, 2, go!"]],
  ["sentences", "小句子起飞", "让短句像火箭一样起飞", [], ["I can type.", "I like my cat.", "We play and learn."]],
  ["sentences", "故事接龙", "把几个短句接成小故事", [], ["The sun is up.", "My dog can run.", "We have fun."]],
  ["sentences", "准确小队", "慢一点也没关系，准确最棒", [], ["I keep my hands home.", "Every key is a star.", "I try again."]],
  ["sentences", "速度小队", "在准确的基础上加一点速度", [], ["The quick fox can jump.", "I type with two hands.", "Keyboard skills grow."]],
  ["challenge", "星球巡航", "完成一趟完整键盘巡航", [], ["I explore the keyboard planet.", "My fingers know the way.", "I type with care."]],
  ["challenge", "星河接力", "把熟悉的键位串成自己的节奏", [], ["I know the keyboard way.", "My hands are calm and ready.", "I can try one more time."]],
  ["celebration", "毕业星光", "你已经准备好点亮键盘星河", [], ["I am a keyboard star!", "I can type my own story.", "The adventure goes on."]],
];

function unique(values) {
  return [...new Set(values)];
}

export function getPromptKeys(prompt) {
  const keys = [];
  for (const character of String(prompt)) {
    if (character === " ") keys.push("space");
    else if (/[A-Z]/.test(character)) keys.push("shift", character.toLowerCase());
    else if (character.length === 1) keys.push(character.toLowerCase());
  }
  return unique(keys);
}

function createLesson(spec, dayNumber, activeKeys, newKeys) {
  const [phase, title, story, , prompts] = spec;
  const week = Math.ceil(dayNumber / 7);
  return Object.freeze({
    dayNumber,
    week,
    phase,
    title,
    story,
    newKeys: Object.freeze([...newKeys]),
    activeKeys: Object.freeze([...activeKeys]),
    prompts: Object.freeze([...prompts]),
  });
}

let unlocked = [];
export const COURSE = Object.freeze(LESSON_SPECS.map((spec, index) => {
  const declaredNewKeys = spec[3];
  const requiredKeys = unique(spec[4].flatMap(getPromptKeys));
  const inferredNewKeys = requiredKeys.filter((key) => !unlocked.includes(key));
  const newKeys = unique([...declaredNewKeys, ...inferredNewKeys]);
  unlocked = unique([...unlocked, ...newKeys]);
  return createLesson(spec, index + 1, unlocked, newKeys);
}));

export function createProfile() {
  return {
    version: 1,
    completedSessions: 0,
    totalSeconds: 0,
    totalStars: 0,
    bestScore: 0,
    difficultyId: "gentle",
    sessionPlanId: "standard",
    audio: { effectsEnabled: true, voiceEnabled: false, volume: 0.6 },
    keyStats: {},
    badges: {},
    history: [],
  };
}

export function getLesson(dayNumber) {
  const safeDay = Math.min(COURSE_DAYS, Math.max(1, Math.floor(dayNumber)));
  return COURSE[safeDay - 1];
}

export function getDailyPlan(profile) {
  const completed = Math.max(0, Math.floor(profile?.completedSessions ?? 0));
  const totalSessions = COURSE_DAYS * SESSIONS_PER_DAY;
  const cappedCompleted = Math.min(completed, totalSessions);
  const dayNumber = Math.min(COURSE_DAYS, Math.floor(cappedCompleted / SESSIONS_PER_DAY) + 1);
  const sessionNumber = cappedCompleted >= totalSessions ? SESSIONS_PER_DAY : (cappedCompleted % SESSIONS_PER_DAY) + 1;
  return { dayNumber, sessionNumber, totalSessions, lesson: getLesson(dayNumber) };
}

export function normalizeKey(key) {
  if (key === " ") return "space";
  if (typeof key !== "string") return "";
  if (key === "Shift") return "shift";
  if (key.length !== 1) return "";
  return key.toLowerCase();
}

export function recordKey(profile, key, isCorrect) {
  const normalized = normalizeKey(key);
  if (!normalized) return profile;
  const oldStats = profile.keyStats[normalized] ?? { hits: 0, errors: 0 };
  return {
    ...profile,
    keyStats: {
      ...profile.keyStats,
      [normalized]: {
        hits: oldStats.hits + (isCorrect ? 1 : 0),
        errors: oldStats.errors + (isCorrect ? 0 : 1),
      },
    },
  };
}

export function getMastery(profile, key) {
  const stats = profile?.keyStats?.[normalizeKey(key)];
  if (!stats) return 0;
  const attempts = stats.hits + stats.errors;
  return attempts === 0 ? 0 : stats.hits / attempts;
}

export function getWeakestKey(profile, activeKeys) {
  return activeKeys.reduce((weakest, key) => {
    if (!weakest) return key;
    return getMastery(profile, key) < getMastery(profile, weakest) ? key : weakest;
  }, "");
}

export function getActivity(index = 0) {
  const safeIndex = Number.isFinite(Number(index)) ? Math.floor(Number(index)) : 0;
  return ACTIVITIES[Math.abs(safeIndex) % ACTIVITIES.length];
}

export function getSessionPlan(planId) {
  return SESSION_PLANS[planId] ?? SESSION_PLANS.standard;
}

export function buildWarmupPrompts(lesson, profile) {
  let keys = lesson.newKeys.filter((key) => key.length === 1);
  if (keys.length === 0) {
    const letters = lesson.activeKeys.filter((key) => /^[a-z]$/.test(key));
    keys = [...letters].sort((a, b) => getMastery(profile, a) - getMastery(profile, b)).slice(0, 2);
  }
  if (keys.length === 0) keys = ["f", "j"];
  const [first, second = first] = keys;
  return [`${first}${first}${first}`, `${second}${second}${second}`, `${first}${second}${first}${second}`];
}

export function buildStagePlan(lesson, planId, profile) {
  const plan = getSessionPlan(planId);
  const stages = [{
    type: "warmup",
    activity: WARMUP_ACTIVITY,
    target: STAGE_TARGETS.warmup,
    prompts: buildWarmupPrompts(lesson, profile),
  }];
  for (let index = 1; index < plan.stages; index += 1) {
    const activity = getActivity(index - 1);
    const isBalloon = activity.id === "balloon-defense";
    stages.push({
      type: isBalloon ? "balloon" : "typing",
      activity,
      target: isBalloon ? STAGE_TARGETS.balloon : STAGE_TARGETS.typing,
    });
  }
  return stages;
}

export function isCountedSession(completedStages, totalStages) {
  const total = Math.max(1, Math.floor(Number(totalStages) || 0));
  const completed = Math.max(0, Math.floor(Number(completedStages) || 0));
  return completed >= Math.ceil(total / 2);
}

function promptIncludesKey(prompt, key) {
  if (key === "space") return prompt.includes(" ");
  if (key === "shift") return prompt !== prompt.toLowerCase();
  return prompt.toLowerCase().includes(key);
}

export function choosePrompt(lesson, profile, offset = 0, previousPrompt = "") {
  const prompts = lesson.prompts;
  const safeOffset = Number.isFinite(Number(offset)) ? Math.abs(Math.floor(Number(offset))) : 0;
  const weakest = getWeakestKey(profile, lesson.activeKeys);
  const matchingPrompts = weakest ? prompts.filter((prompt) => promptIncludesKey(prompt, weakest)) : prompts;
  // 每第三条从全部题目里取，避免弱键过滤把整节课收窄成一两条题目。
  const pool = safeOffset % 3 === 2 || matchingPrompts.length === 0 ? prompts : matchingPrompts;
  const prompt = pool[safeOffset % pool.length];
  if (prompt === previousPrompt && pool.length > 1) return pool[(safeOffset + 1) % pool.length];
  return prompt;
}

export const BADGES = Object.freeze([
  Object.freeze({ id: "first-flight", title: "首航星", icon: "✦", description: "完成第一次正式课次" }),
  Object.freeze({ id: "sharp-eyes", title: "稳准小手", icon: "◎", description: "一次正式课次准确率达到 98%" }),
  Object.freeze({ id: "star-collector", title: "星星收藏家", icon: "✧", description: "累计收集 1000 颗星星" }),
  Object.freeze({ id: "three-day-streak", title: "连飞三天", icon: "➹", description: "连续 3 天完成正式课次" }),
  Object.freeze({ id: "home-row-hero", title: "家排小英雄", icon: "⌂", description: "完成第一周的家排课程" }),
  Object.freeze({ id: "graduate", title: "毕业星光", icon: "★", description: "完成全部 84 次课程" }),
]);

function hasConsecutiveDays(entries, requiredDays) {
  const days = [...new Set(entries
    .map((entry) => typeof entry.completedAt === "string" ? entry.completedAt.slice(0, 10) : "")
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort();
  if (requiredDays <= 1) return days.length > 0;
  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const gap = (Date.parse(`${days[index]}T00:00:00Z`) - Date.parse(`${days[index - 1]}T00:00:00Z`)) / 86400000;
    streak = gap === 1 ? streak + 1 : 1;
    if (streak >= requiredDays) return true;
  }
  return false;
}

export function evaluateBadges(profile, earnedAt = new Date().toISOString()) {
  const earned = { ...(profile.badges ?? {}) };
  const countedEntries = (profile.history ?? []).filter((entry) => entry.counted !== false);
  const award = (id, condition) => {
    if (!earned[id] && condition) earned[id] = earnedAt;
  };
  award("first-flight", profile.completedSessions >= 1);
  award("sharp-eyes", countedEntries.some((entry) => entry.accuracy >= 0.98));
  award("star-collector", (profile.totalStars ?? 0) >= 1000);
  award("three-day-streak", hasConsecutiveDays(countedEntries, 3));
  award("home-row-hero", profile.completedSessions >= 14);
  award("graduate", profile.completedSessions >= COURSE_DAYS * SESSIONS_PER_DAY);
  return earned;
}

export function completeSession(profile, result = {}) {
  const plan = getDailyPlan(profile);
  const accuracy = Math.min(1, Math.max(0, Number(result.accuracy) || 0));
  const elapsedSeconds = Math.min(MAX_SESSION_SECONDS, Math.max(0, Number(result.elapsedSeconds) || 0));
  const totalStages = Math.min(12, Math.max(1, Math.floor(Number(result.totalStages) || 1)));
  const completedStages = Math.min(totalStages, Math.max(0, Math.floor(Number(result.completedStages) || 0)));
  const score = Math.min(100000, Math.max(0, Math.floor(Number(result.score) || 0)));
  const counted = isCountedSession(completedStages, totalStages);
  const completedAt = result.completedAt ?? null;
  const historyEntry = {
    dayNumber: plan.dayNumber,
    sessionNumber: plan.sessionNumber,
    accuracy,
    elapsedSeconds,
    completedAt,
    completedStages,
    totalStages,
    counted,
    score,
  };
  const next = {
    ...profile,
    completedSessions: counted
      ? Math.min(COURSE_DAYS * SESSIONS_PER_DAY, profile.completedSessions + 1)
      : profile.completedSessions,
    totalSeconds: profile.totalSeconds + elapsedSeconds,
    totalStars: (profile.totalStars ?? 0) + score,
    bestScore: counted ? Math.max(profile.bestScore ?? 0, score) : (profile.bestScore ?? 0),
    history: [...profile.history, historyEntry].slice(-HISTORY_LIMIT),
  };
  return { ...next, badges: evaluateBadges(next, completedAt ?? undefined) };
}

export function getCourseProgress(profile) {
  const completedSessions = Math.min(profile?.completedSessions ?? 0, COURSE_DAYS * SESSIONS_PER_DAY);
  return {
    completedSessions,
    percent: Math.round((completedSessions / (COURSE_DAYS * SESSIONS_PER_DAY)) * 100),
    completedDays: Math.floor(completedSessions / SESSIONS_PER_DAY),
    totalDays: COURSE_DAYS,
  };
}

export const KEY_ROWS = Object.freeze({
  top: Object.freeze(TOP_ROW),
  home: Object.freeze(HOME_ROW),
  bottom: Object.freeze(BOTTOM_ROW),
});