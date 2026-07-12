import test from "node:test";
import assert from "node:assert/strict";

import {
  BALLOON_EXPLOSION_SECONDS,
  PROJECTILE_FLIGHT_SECONDS,
  createBalloonRound,
  shootBalloon,
  spawnBalloon,
  updateBalloonRound,
} from "../src/balloon-game.js";

test("a balloon round starts with an empty field and safe defaults", () => {
  const round = createBalloonRound(["f", "j"]);

  assert.equal(round.balloons.length, 0);
  assert.equal(round.hits, 0);
  assert.equal(round.misses, 0);
  assert.equal(round.status, "playing");
});

test("falling balloons move downward and eventually count as misses", () => {
  const round = spawnBalloon(createBalloonRound(["f"]), "f", () => 0.5);
  const falling = updateBalloonRound(round, 0.5, () => 0.5);
  const missed = updateBalloonRound(falling, 12, () => 0.5);

  assert.ok(falling.balloons[0].y > round.balloons[0].y);
  assert.ok(missed.misses >= 1);
});

test("pressing a balloon letter shoots the lowest matching balloon", () => {
  let round = createBalloonRound(["f", "j"]);
  round = spawnBalloon(round, "f", () => 0.2);
  round = { ...round, balloons: round.balloons.map((balloon) => ({ ...balloon, y: 100 })) };
  round = spawnBalloon(round, "f", () => 0.8);
  round = { ...round, balloons: round.balloons.map((balloon, index) => index === 1 ? { ...balloon, y: 200 } : balloon) };

  const result = shootBalloon(round, "f");

  assert.equal(result.shot, true);
  assert.equal(result.round.hits, 1);
  assert.equal(result.round.balloons.length, 2);
  assert.equal(result.round.balloons[0].y, 100);
  assert.equal(result.round.balloons[1].y, 200);
  assert.equal(result.round.balloons[1].state, "exploding");
  assert.equal(result.round.projectiles.length, 1);
});

test("a projectile travels to its target and an explosion clears after the hit", () => {
  let round = spawnBalloon(createBalloonRound(["f"]), "f", () => 0.8);
  const targetId = round.balloons[0].id;
  const shot = shootBalloon(round, "f").round;

  const inFlight = updateBalloonRound(shot, PROJECTILE_FLIGHT_SECONDS / 2, () => 0.5);
  assert.ok(inFlight.projectiles[0].x > inFlight.projectiles[0].startX);
  assert.equal(inFlight.balloons[0].state, "exploding");

  const finished = updateBalloonRound(
    inFlight,
    PROJECTILE_FLIGHT_SECONDS + BALLOON_EXPLOSION_SECONDS,
    () => 0.5,
  );
  assert.equal(finished.projectiles.length, 0);
  assert.equal(finished.balloons.some((balloon) => balloon.id === targetId), false);
});

test("an exploding balloon cannot be shot a second time", () => {
  const round = spawnBalloon(createBalloonRound(["f"]), "f");
  const shot = shootBalloon(round, "f");
  const secondShot = shootBalloon(shot.round, "f");

  assert.equal(secondShot.shot, false);
  assert.equal(secondShot.round.hits, 1);
});

test("pressing a key without a matching balloon does not spend a shot", () => {
  const result = shootBalloon(spawnBalloon(createBalloonRound(["f"]), "f"), "j");

  assert.equal(result.shot, false);
  assert.equal(result.round.shots, 0);
  assert.equal(result.round.hits, 0);
});
