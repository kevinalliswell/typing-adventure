export const SESSION_GATES = Object.freeze([
  Object.freeze({ id: "warmup", name: "热身关", icon: "1", minCorrect: 12, minStations: 2 }),
  Object.freeze({ id: "mission", name: "探险关", icon: "2", minCorrect: 36, minStations: 6 }),
  Object.freeze({ id: "challenge", name: "冲刺关", icon: "3", minCorrect: 60, minStations: 10 }),
]);

function boundedNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function getRunAccuracy(run) {
  const correct = boundedNumber(run?.correct);
  const total = boundedNumber(run?.total);
  return total === 0 ? 0 : Math.min(1, correct / total);
}

export function getGateAccuracyTarget(gateIndex, difficulty = {}) {
  const finalTarget = boundedNumber(difficulty.targetAccuracy, 0.86, 1);
  if (gateIndex <= 0) return 0.8;
  if (gateIndex === 1) return Math.max(0.8, finalTarget - 0.06);
  return finalTarget;
}

function gateIsComplete(gate, gateIndex, run, accuracy, difficulty) {
  return boundedNumber(run?.correct) >= gate.minCorrect
    && boundedNumber(run?.completedPrompts) >= gate.minStations
    && accuracy >= getGateAccuracyTarget(gateIndex, difficulty);
}

export function getSessionProgress(run, difficulty = {}) {
  const accuracy = getRunAccuracy(run);
  let completedGates = 0;

  for (const [index, gate] of SESSION_GATES.entries()) {
    if (!gateIsComplete(gate, index, run, accuracy, difficulty)) break;
    completedGates += 1;
  }

  const complete = completedGates === SESSION_GATES.length;
  const gateIndex = complete ? SESSION_GATES.length - 1 : completedGates;
  const gate = SESSION_GATES[gateIndex];
  const targetAccuracy = getGateAccuracyTarget(gateIndex, difficulty);
  const correct = boundedNumber(run?.correct);
  const stations = boundedNumber(run?.completedPrompts);
  const requirements = {
    correct: Math.max(0, gate.minCorrect - correct),
    stations: Math.max(0, gate.minStations - stations),
    accuracy: Math.max(0, targetAccuracy - accuracy),
  };
  const gatePercent = complete ? 100 : Math.round(Math.min(
    correct / gate.minCorrect,
    stations / gate.minStations,
    targetAccuracy === 0 ? 1 : accuracy / targetAccuracy,
    1,
  ) * 100);

  return {
    accuracy,
    complete,
    completedGates,
    gate,
    gateIndex,
    gatePercent,
    requirements,
    targetAccuracy,
  };
}

export function shouldShowTargetHint(difficulty = {}, gateIndex = 0, consecutiveErrors = 0) {
  const safeGate = Math.max(0, Math.min(SESSION_GATES.length - 1, Math.floor(Number(gateIndex) || 0)));
  if (safeGate === 0) return true;
  if (safeGate === 1 && difficulty.id === "gentle") return true;
  const errorsNeeded = Math.max(1, Math.floor(Number(difficulty.hintAfterErrors) || 1));
  return boundedNumber(consecutiveErrors) >= errorsNeeded;
}
