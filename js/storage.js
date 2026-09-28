// Persistence layer: uploaded question sets live in localStorage so they survive reloads.
const SETS_KEY = "examsim.sets.v1";

function safeParse(json, fallback) {
  try {
    const v = JSON.parse(json);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadUploadedSets() {
  return safeParse(localStorage.getItem(SETS_KEY), []);
}

export function saveUploadedSets(sets) {
  localStorage.setItem(SETS_KEY, JSON.stringify(sets));
}

export function addUploadedSet(set) {
  const sets = loadUploadedSets();
  sets.push(set);
  saveUploadedSets(sets);
  return sets;
}

export function removeUploadedSet(setId) {
  const sets = loadUploadedSets().filter((s) => s.id !== setId);
  saveUploadedSets(sets);
  return sets;
}
