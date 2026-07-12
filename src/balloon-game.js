export const BALLOON_FIELD_HEIGHT = 340;
export const PROJECTILE_FLIGHT_SECONDS = 0.24;
export const BALLOON_EXPLOSION_SECONDS = 0.36;
const SPAWN_INTERVAL = 0.95;
const BALLOON_SIZE = 54;
const PROJECTILE_START_Y = BALLOON_FIELD_HEIGHT - 75;

function safeRandom(random) {
  const value = Number(random?.());
  return Number.isFinite(value) ? Math.min(0.999, Math.max(0, value)) : 0.5;
}

function normalizeBalloonKey(key) {
  return typeof key === "string" && /^[a-z]$/i.test(key) ? key.toLowerCase() : "";
}

function pickKey(keys, random) {
  return keys[Math.floor(safeRandom(random) * keys.length)] ?? "f";
}

export function createBalloonRound(keys, random = Math.random) {
  const playableKeys = [...new Set((keys ?? []).map(normalizeBalloonKey).filter(Boolean))];
  return {
    keys: playableKeys.length > 0 ? playableKeys : ["f", "j"],
    balloons: [],
    nextId: 0,
    spawnIn: 0.45,
    width: 100,
    height: BALLOON_FIELD_HEIGHT,
    hits: 0,
    misses: 0,
    shots: 0,
    score: 0,
    shotFlash: 0,
    lastShotKey: "",
    projectiles: [],
    nextShotId: 0,
    status: "playing",
    seedHint: safeRandom(random),
  };
}

export function spawnBalloon(round, key, random = Math.random) {
  const normalized = normalizeBalloonKey(key);
  if (round.status !== "playing" || !round.keys.includes(normalized)) return round;
  const id = round.nextId;
  const balloon = {
    id,
    key: normalized,
    x: 8 + safeRandom(random) * 84,
    y: -BALLOON_SIZE,
    speed: 44 + safeRandom(random) * 28,
    size: BALLOON_SIZE,
  };
  return {
    ...round,
    balloons: [...round.balloons, balloon],
    nextId: id + 1,
  };
}

export function updateBalloonRound(round, elapsedSeconds, random = Math.random) {
  if (round.status !== "playing") return round;
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  let misses = 0;
  const balloons = round.balloons.flatMap((balloon) => {
    if (balloon.state === "exploding") {
      const explodeIn = balloon.explodeIn - elapsed;
      return explodeIn > 0 ? [{ ...balloon, explodeIn }] : [];
    }
    const nextY = balloon.y + balloon.speed * elapsed;
    if (nextY > round.height - balloon.size) {
      misses += 1;
      return [];
    }
    return [{ ...balloon, y: nextY }];
  });
  const projectiles = (round.projectiles ?? []).flatMap((projectile) => {
    const elapsedTime = projectile.elapsed + elapsed;
    if (elapsedTime >= projectile.duration) return [];
    const progress = elapsedTime / projectile.duration;
    return [{
      ...projectile,
      elapsed: elapsedTime,
      x: projectile.startX + (projectile.targetX - projectile.startX) * progress,
      y: projectile.startY + (projectile.targetY - projectile.startY) * progress,
    }];
  });
  let next = {
    ...round,
    balloons,
    projectiles,
    misses: round.misses + misses,
    spawnIn: round.spawnIn - elapsed,
    shotFlash: Math.max(0, round.shotFlash - elapsed),
    lastShotKey: round.shotFlash > 0 ? round.lastShotKey : "",
  };
  while (next.spawnIn <= 0) {
    next = spawnBalloon(next, pickKey(next.keys, random), random);
    next.spawnIn += SPAWN_INTERVAL;
  }
  return next;
}

export function shootBalloon(round, key) {
  if (round.status !== "playing") return { round, shot: false };
  const normalized = normalizeBalloonKey(key);
  const matching = round.balloons.filter((balloon) => balloon.key === normalized && balloon.state !== "exploding");
  if (matching.length === 0) return { round, shot: false };
  const target = matching.reduce((lowest, balloon) => balloon.y > lowest.y ? balloon : lowest);
  const shotId = round.nextShotId ?? 0;
  const projectile = {
    id: shotId,
    startX: 50,
    startY: PROJECTILE_START_Y,
    targetX: target.x,
    targetY: target.y + target.size / 2,
    x: 50,
    y: PROJECTILE_START_Y,
    elapsed: 0,
    duration: PROJECTILE_FLIGHT_SECONDS,
  };
  return {
    round: {
      ...round,
      balloons: round.balloons.map((balloon) => balloon.id === target.id
        ? {
          ...balloon,
          state: "exploding",
          explodeIn: PROJECTILE_FLIGHT_SECONDS + BALLOON_EXPLOSION_SECONDS,
        }
        : balloon),
      hits: round.hits + 1,
      shots: round.shots + 1,
      score: round.score + 15,
      shotFlash: 0.18,
      lastShotKey: normalized,
      projectiles: [...(round.projectiles ?? []), projectile],
      nextShotId: shotId + 1,
    },
    shot: true,
  };
}
