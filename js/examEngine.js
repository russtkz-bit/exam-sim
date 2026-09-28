import { DOMAINS, OBJECTIVE_INDEX, EXAM_INFO } from "./data/objectives.js";

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Combine questions from every selected set, tagging each with its origin set name,
// then keep only questions whose objective code is in `selectedObjectiveIds`.
export function buildPool(selectedSets, selectedObjectiveIds) {
  const objSet = new Set(selectedObjectiveIds);
  const pool = [];
  for (const set of selectedSets) {
    for (const q of set.questions) {
      if (objSet.has(q.domain)) {
        pool.push({ ...q, _setName: set.setName, _setId: set.id });
      }
    }
  }
  return pool;
}

export function poolStatsByObjective(pool) {
  const stats = {};
  for (const objId of Object.keys(OBJECTIVE_INDEX)) stats[objId] = 0;
  for (const q of pool) stats[q.domain] = (stats[q.domain] || 0) + 1;
  return stats;
}

// Build the official SY0-701 weighted question count per domain for a given total,
// used by the "standard full exam" preset.
export function weightedDomainCounts(total) {
  const raw = DOMAINS.map((d) => ({ id: d.id, exact: (d.weight / 100) * total }));
  const floors = raw.map((r) => ({ id: r.id, count: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let assigned = floors.reduce((s, f) => s + f.count, 0);
  let remaining = total - assigned;
  const byRemDesc = [...floors].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remaining; i++) byRemDesc[i % byRemDesc.length].count += 1;
  const out = {};
  for (const f of floors) out[f.id] = f.count;
  return out;
}

// Selects `count` questions from `pool`, distributed as evenly as possible across
// objectives present in the pool (so one over-represented objective doesn't dominate),
// then trims/shuffles to the exact count.
export function pickQuestions(pool, count, { shuffleQuestions = true } = {}) {
  if (count >= pool.length) return shuffleQuestions ? shuffle(pool) : pool.slice();

  const byObjective = {};
  for (const q of pool) {
    (byObjective[q.domain] = byObjective[q.domain] || []).push(q);
  }
  for (const key of Object.keys(byObjective)) byObjective[key] = shuffle(byObjective[key]);

  const objectives = Object.keys(byObjective);
  const picked = [];
  let round = 0;
  while (picked.length < count) {
    let addedThisRound = false;
    for (const objId of objectives) {
      if (picked.length >= count) break;
      const bucket = byObjective[objId];
      if (bucket[round]) {
        picked.push(bucket[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round++;
  }
  return shuffleQuestions ? shuffle(picked) : picked;
}

export function prepareSessionQuestions(questions, { shuffleOptions = true } = {}) {
  return questions.map((q) => {
    if (!shuffleOptions) return { ...q, displayOptions: q.options.map((_, i) => i) };
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, displayOptions: order };
  });
}

export function isCorrect(question, selectedIndices) {
  const a = [...question.answer].sort().join(",");
  const b = [...new Set(selectedIndices)].sort().join(",");
  return a === b;
}

export function scoreSession(questions, answersById) {
  const perObjective = {};
  const perDomain = {};
  for (const d of DOMAINS) perDomain[d.id] = { correct: 0, total: 0, name: d.name };
  for (const objId of Object.keys(OBJECTIVE_INDEX)) {
    perObjective[objId] = { correct: 0, total: 0, title: OBJECTIVE_INDEX[objId].title };
  }

  let correctCount = 0;
  const details = [];

  for (const q of questions) {
    const selected = answersById[q.id] || [];
    const correct = isCorrect(q, selected);
    if (correct) correctCount++;

    const domainId = OBJECTIVE_INDEX[q.domain]?.domainId;
    perObjective[q.domain].total++;
    if (correct) perObjective[q.domain].correct++;
    if (domainId) {
      perDomain[domainId].total++;
      if (correct) perDomain[domainId].correct++;
    }

    details.push({ question: q, selected, correct });
  }

  const total = questions.length;
  const percent = total ? Math.round((correctCount / total) * 1000) / 10 : 0;
  const scaled = Math.round(
    EXAM_INFO.scaledScoreRange[0] +
      (correctCount / Math.max(total, 1)) * (EXAM_INFO.scaledScoreRange[1] - EXAM_INFO.scaledScoreRange[0])
  );
  const passed = scaled >= EXAM_INFO.passingScaledScore;

  return { correctCount, total, percent, scaled, passed, perDomain, perObjective, details };
}
