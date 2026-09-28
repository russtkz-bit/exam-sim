// Persistence layer. Uses localStorage rather than cookies: this is a static,
// server-less app, so there is nothing to send the value to on every request —
// localStorage keeps the same "survives reload, per-browser" behavior without
// the size limits and request overhead of cookies.
const SETS_KEY = "examsim.sets.v1";
const SETTINGS_KEY = "examsim.settings.v1";

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

// Remembers the user's last-used setup screen: which sets/objectives were
// checked and the chosen exam options, so a reload doesn't reset the filters.
export function loadSettings() {
  return safeParse(localStorage.getItem(SETTINGS_KEY), null);
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
