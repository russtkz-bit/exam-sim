import { DOMAINS, OBJECTIVE_INDEX, EXAM_INFO, allObjectiveIds } from "./data/objectives.js";
import { SAMPLE_SET } from "./data/sampleQuestions.js";
import { loadUploadedSets, addUploadedSet, removeUploadedSet, loadSettings, saveSettings } from "./storage.js";
import { validateQuestionSet, BLANK_TOKEN } from "./validation.js";
import {
  buildPool,
  poolStatsByObjective,
  weightedDomainCounts,
  pickQuestions,
  prepareSessionQuestions,
  scoreSession,
  blankResponse,
  hasAnyAnswer,
} from "./examEngine.js";
import { UPLOAD_FORMAT_DOC, UPLOAD_FORMAT_EXAMPLE } from "./promptTemplate.js";

const BUILTIN_SET = { id: "builtin", setName: SAMPLE_SET.setName, questions: SAMPLE_SET.questions, builtin: true };

const state = {
  sets: [], // { id, setName, questions, builtin? }
  enabledSetIds: new Set(["builtin"]),
  selectedObjectives: new Set(allObjectiveIds()),
  timerEnabled: true,
  timerMinutes: 90,
  numQuestions: 20,
  shuffleQuestions: true,
  shuffleOptions: true,
  // exam session
  session: null, // { questions, answers:{}, marked:Set, index, endsAt, timerId }
  lastResult: null,
};

function el(sel, root = document) {
  return root.querySelector(sel);
}
function elAll(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}
function ce(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

function allSets() {
  return [BUILTIN_SET, ...state.sets];
}
function enabledSets() {
  return allSets().filter((s) => state.enabledSetIds.has(s.id));
}

function showPage(id) {
  elAll(".page").forEach((p) => p.classList.toggle("active", p.id === id));
  elAll(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.page === id));
}

// ---------------------------------------------------------------- Setup page

function renderSetsPanel() {
  const container = el("#sets-list");
  container.innerHTML = "";
  for (const set of allSets()) {
    const count = set.questions.length;
    const checked = state.enabledSetIds.has(set.id);
    const row = ce("div", { class: "set-row" }, [
      ce("label", { class: "set-check" }, [
        ce("input", {
          type: "checkbox",
          ...(checked ? { checked: "checked" } : {}),
          onchange: (e) => {
            if (e.target.checked) state.enabledSetIds.add(set.id);
            else state.enabledSetIds.delete(set.id);
            refreshPoolCount();
          },
        }),
        ce("span", {}, `${set.setName}`),
        ce("span", { class: "badge" }, `${count} q`),
        set.builtin ? ce("span", { class: "badge badge-muted" }, "built-in") : null,
      ]),
      !set.builtin
        ? ce("button", {
            class: "btn-link danger",
            onclick: () => {
              if (!confirm(`Remove set "${set.setName}"?`)) return;
              removeUploadedSet(set.id);
              state.sets = loadUploadedSets();
              state.enabledSetIds.delete(set.id);
              renderSetsPanel();
              refreshPoolCount();
            },
          }, "Remove")
        : null,
    ]);
    container.appendChild(row);
  }
}

function renderDomainFilters() {
  const container = el("#domain-filters");
  container.innerHTML = "";
  for (const domain of DOMAINS) {
    const objIds = domain.objectives.map((o) => o.id);
    const allChecked = objIds.every((id) => state.selectedObjectives.has(id));
    const someChecked = objIds.some((id) => state.selectedObjectives.has(id));

    const card = ce("div", { class: "domain-card" });
    const header = ce("div", { class: "domain-header" }, [
      ce("label", { class: "domain-check" }, [
        ce("input", {
          type: "checkbox",
          ...(allChecked ? { checked: "checked" } : {}),
          onchange: (e) => {
            objIds.forEach((id) => (e.target.checked ? state.selectedObjectives.add(id) : state.selectedObjectives.delete(id)));
            renderDomainFilters();
            refreshPoolCount();
          },
        }),
        ce("strong", {}, `${domain.id} ${domain.name}`),
        ce("span", { class: "badge" }, `${domain.weight}%`),
      ]),
    ]);
    if (someChecked && !allChecked) header.classList.add("partial");
    card.appendChild(header);

    const objList = ce("div", { class: "objective-list" });
    for (const obj of domain.objectives) {
      const checked = state.selectedObjectives.has(obj.id);
      objList.appendChild(
        ce("label", { class: "objective-row" }, [
          ce("input", {
            type: "checkbox",
            ...(checked ? { checked: "checked" } : {}),
            onchange: (e) => {
              if (e.target.checked) state.selectedObjectives.add(obj.id);
              else state.selectedObjectives.delete(obj.id);
              renderDomainFilters();
              refreshPoolCount();
            },
          }),
          ce("span", { class: "obj-code" }, obj.id),
          ce("span", { class: "obj-title" }, obj.title),
          ce("span", { class: "badge badge-muted count-badge", "data-obj": obj.id }, ""),
        ])
      );
    }
    card.appendChild(objList);

    const rangeRow = ce("div", { class: "range-row" }, [
      ce("input", {
        type: "text",
        placeholder: `e.g. ${objIds[0]}-${objIds[Math.max(0, objIds.length - 2)]}`,
        class: "range-input",
      }),
      ce("button", {
        class: "btn-link",
        onclick: (e) => {
          const input = e.target.previousElementSibling;
          applyRange(domain, input.value);
          renderDomainFilters();
          refreshPoolCount();
        },
      }, "Apply range"),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.add(id)); renderDomainFilters(); refreshPoolCount(); } }, "All"),
      ce("button", { class: "btn-link", onclick: () => { objIds.forEach((id) => state.selectedObjectives.delete(id)); renderDomainFilters(); refreshPoolCount(); } }, "None"),
    ]);
    card.appendChild(rangeRow);

    container.appendChild(card);
  }
  updateObjectiveCounts();
}

// Parses things like "1.1-1.3" or "1.1,1.3" or "1.1-1.2,1.4" scoped to one domain,
// selecting exactly the matched objectives within that domain and deselecting the rest.
function applyRange(domain, text) {
  const objIds = domain.objectives.map((o) => o.id);
  objIds.forEach((id) => state.selectedObjectives.delete(id));
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  const matched = new Set();
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+\.\d+)\s*-\s*(\d+\.\d+)$/);
    if (rangeMatch) {
      const [, startId, endId] = rangeMatch;
      const startIdx = objIds.indexOf(startId);
      const endIdx = objIds.indexOf(endId);
      if (startIdx !== -1 && endIdx !== -1) {
        const [lo, hi] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = lo; i <= hi; i++) matched.add(objIds[i]);
        continue;
      }
    }
    if (objIds.includes(part)) matched.add(part);
  }
  matched.forEach((id) => state.selectedObjectives.add(id));
}

function updateObjectiveCounts() {
  const pool = buildPool(enabledSets(), allObjectiveIds());
  const stats = poolStatsByObjective(pool);
  elAll(".count-badge").forEach((badge) => {
    const objId = badge.dataset.obj;
    badge.textContent = `${stats[objId] || 0} q`;
  });
}

function refreshPoolCount() {
  updateObjectiveCounts();
  const pool = buildPool(enabledSets(), [...state.selectedObjectives]);
  el("#pool-count").textContent = pool.length;
  const maxInput = el("#num-questions");
  maxInput.max = Math.max(pool.length, 1);
  if (Number(maxInput.value) > pool.length && pool.length > 0) maxInput.value = pool.length;
  el("#start-exam-btn").disabled = pool.length === 0;
  el("#pool-warning").style.display = pool.length === 0 ? "block" : "none";
  persistSettings();
}

// ------------------------------------------------------------- Persistence

// Remembers the setup screen (which sets/objectives are checked, exam options)
// across reloads, since re-picking the same filters every time is tedious.
function persistSettings() {
  saveSettings({
    enabledSetIds: [...state.enabledSetIds],
    selectedObjectives: [...state.selectedObjectives],
    numQuestions: Number(el("#num-questions").value) || 20,
    timerEnabled: el("#timer-toggle").checked,
    timerMinutes: Number(el("#timer-minutes").value) || 90,
    shuffleQuestions: el("#shuffle-questions").checked,
    shuffleOptions: el("#shuffle-options").checked,
  });
}

function applySavedSettings(saved) {
  if (!saved) return;
  if (Array.isArray(saved.enabledSetIds)) {
    const validIds = new Set(allSets().map((s) => s.id));
    const restored = new Set(saved.enabledSetIds.filter((id) => validIds.has(id)));
    state.enabledSetIds = restored.size > 0 ? restored : new Set(["builtin"]);
  }
  if (Array.isArray(saved.selectedObjectives)) {
    state.selectedObjectives = new Set(saved.selectedObjectives.filter((id) => OBJECTIVE_INDEX[id]));
  }
  if (typeof saved.numQuestions === "number" && saved.numQuestions > 0) el("#num-questions").value = saved.numQuestions;
  if (typeof saved.timerEnabled === "boolean") el("#timer-toggle").checked = saved.timerEnabled;
  if (typeof saved.timerMinutes === "number" && saved.timerMinutes > 0) el("#timer-minutes").value = saved.timerMinutes;
  if (typeof saved.shuffleQuestions === "boolean") el("#shuffle-questions").checked = saved.shuffleQuestions;
  if (typeof saved.shuffleOptions === "boolean") el("#shuffle-options").checked = saved.shuffleOptions;
}

function applyStandardPreset() {
  allObjectiveIds().forEach((id) => state.selectedObjectives.add(id));
  const total = Math.min(EXAM_INFO.fullExamQuestions, buildPool(enabledSets(), allObjectiveIds()).length);
  state.numQuestions = total;
  state.timerEnabled = true;
  state.timerMinutes = EXAM_INFO.fullExamMinutes;
  el("#num-questions").value = total;
  el("#timer-minutes").value = EXAM_INFO.fullExamMinutes;
  el("#timer-toggle").checked = true;
  renderDomainFilters();
  refreshPoolCount();
}

// ------------------------------------------------------------------- Upload

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let raw;
    try {
      raw = JSON.parse(reader.result);
    } catch (e) {
      showUploadResult({ valid: false, errors: [`Could not parse JSON: ${e.message}`], warnings: [] });
      return;
    }
    const result = validateQuestionSet(raw, file.name.replace(/\.json$/i, ""));
    showUploadResult(result);
    if (result.set && result.set.questions.length > 0) {
      window.__pendingImport = result;
    }
  };
  reader.readAsText(file);
}

function showUploadResult(result) {
  const box = el("#upload-result");
  box.innerHTML = "";
  box.style.display = "block";
  const parsedCount = result.set ? result.set.questions.length : 0;

  if (result.valid) {
    box.appendChild(ce("div", { class: "upload-ok" }, `✓ Parsed ${parsedCount} valid question(s).`));
  } else if (parsedCount > 0) {
    box.appendChild(
      ce("div", { class: "upload-warn" }, `⚠ ${parsedCount} question(s) parsed OK, but ${result.errors.length} error(s) found. You can still import the valid subset.`)
    );
  } else {
    box.appendChild(ce("div", { class: "upload-error" }, `✗ Import failed — no valid questions found.`));
  }

  if (result.errors.length) {
    const list = ce("ul", { class: "error-list" });
    result.errors.slice(0, 15).forEach((e) => list.appendChild(ce("li", {}, e)));
    if (result.errors.length > 15) list.appendChild(ce("li", {}, `...and ${result.errors.length - 15} more.`));
    box.appendChild(list);
  }
  if (result.warnings.length) {
    const list = ce("ul", { class: "warn-list" });
    result.warnings.forEach((w) => list.appendChild(ce("li", {}, w)));
    box.appendChild(list);
  }

  if (parsedCount > 0) {
    box.appendChild(
      ce("button", {
        class: "btn primary small",
        onclick: () => {
          const pending = window.__pendingImport;
          if (!pending || !pending.set) return;
          const newSet = { id: `up-${Date.now()}`, setName: pending.set.setName, questions: pending.set.questions };
          addUploadedSet(newSet);
          state.sets = loadUploadedSets();
          state.enabledSetIds.add(newSet.id);
          renderSetsPanel();
          refreshPoolCount();
          box.style.display = "none";
          el("#file-input").value = "";
        },
      }, `Import ${parsedCount} question(s) into a new set`)
    );
  }
}

// -------------------------------------------------------------- Instructions

function renderInstructions() {
  el("#instructions-text").textContent = UPLOAD_FORMAT_DOC;
}

function downloadExample() {
  const blob = new Blob([JSON.stringify(UPLOAD_FORMAT_EXAMPLE, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sy0-701-example-set.json";
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------------- Exam

function startExam() {
  const pool = buildPool(enabledSets(), [...state.selectedObjectives]);
  if (pool.length === 0) return;

  const numQuestions = Math.max(1, Math.min(Number(el("#num-questions").value) || pool.length, pool.length));
  const shuffleQuestions = el("#shuffle-questions").checked;
  const shuffleOptions = el("#shuffle-options").checked;
  const timerEnabled = el("#timer-toggle").checked;
  const timerMinutes = Math.max(1, Number(el("#timer-minutes").value) || 90);

  const chosen = pickQuestions(pool, numQuestions, { shuffleQuestions });
  const questions = prepareSessionQuestions(chosen, { shuffleOptions });

  state.session = {
    questions,
    answers: {},
    marked: new Set(),
    index: 0,
    timerEnabled,
    endsAt: timerEnabled ? Date.now() + timerMinutes * 60000 : null,
    timerId: null,
  };

  showPage("page-exam");
  renderExam();
  if (timerEnabled) startTimer();
}

function startTimer() {
  stopTimer();
  const tick = () => {
    const s = state.session;
    if (!s) return;
    const msLeft = s.endsAt - Date.now();
    if (msLeft <= 0) {
      el("#exam-timer").textContent = "00:00";
      finishExam();
      return;
    }
    const totalSec = Math.floor(msLeft / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const sec = String(totalSec % 60).padStart(2, "0");
    el("#exam-timer").textContent = `${m}:${sec}`;
  };
  tick();
  state.session.timerId = setInterval(tick, 1000);
}
function stopTimer() {
  if (state.session?.timerId) clearInterval(state.session.timerId);
}

const PBQ_TYPE_LABELS = {
  single: "Multiple choice",
  multiple: "Multiple choice (select all that apply)",
  matching: "Performance-based: Matching",
  ordering: "Performance-based: Ordering",
  fill_blank: "Performance-based: Fill in the blank",
  hotspot: "Performance-based: Hotspot",
  simulation: "Performance-based: Simulation",
};

function renderExam() {
  const s = state.session;
  const q = s.questions[s.index];
  if (!(q.id in s.answers)) s.answers[q.id] = blankResponse(q);

  el("#exam-progress").textContent = `Question ${s.index + 1} of ${s.questions.length}`;
  el("#exam-timer-wrap").style.display = s.timerEnabled ? "inline-block" : "none";
  el("#question-domain").textContent = `${q.domain} — ${OBJECTIVE_INDEX[q.domain]?.title || ""} · ${PBQ_TYPE_LABELS[q.type] || ""}`;

  const optionsBox = el("#options-box");
  optionsBox.innerHTML = "";
  el("#question-text").style.display = q.type === "fill_blank" ? "none" : "block";
  el("#question-text").textContent = q.question;

  const renderer = QUESTION_RENDERERS[q.type] || QUESTION_RENDERERS.choice;
  renderer(q, s, optionsBox);

  el("#mark-review-btn").classList.toggle("active", s.marked.has(q.id));
  el("#prev-btn").disabled = s.index === 0;
  el("#next-btn").style.display = s.index === s.questions.length - 1 ? "none" : "inline-block";
  el("#finish-btn").style.display = s.index === s.questions.length - 1 ? "inline-block" : "none";

  renderPalette();
}

function setAnswer(s, q, response) {
  s.answers[q.id] = response;
  renderPalette();
}

const QUESTION_RENDERERS = {
  choice(q, s, box) {
    const inputType = q.type === "multiple" ? "checkbox" : "radio";
    const selected = new Set(s.answers[q.id] || []);
    q.displayOptions.forEach((origIdx) => {
      const row = ce("label", { class: "option-row" }, [
        ce("input", {
          type: inputType,
          name: "option",
          ...(selected.has(origIdx) ? { checked: "checked" } : {}),
          onchange: (e) => {
            let sel = new Set(s.answers[q.id] || []);
            if (inputType === "radio") sel = new Set([origIdx]);
            else if (e.target.checked) sel.add(origIdx);
            else sel.delete(origIdx);
            setAnswer(s, q, [...sel]);
          },
        }),
        ce("span", {}, q.options[origIdx]),
      ]);
      box.appendChild(row);
    });
  },

  matching(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, "Assign each item on the left to the correct match on the right."));
    const response = s.answers[q.id] || blankResponse(q);
    q.prompts.forEach((promptText, promptIdx) => {
      const select = ce("select", {
        onchange: (e) => {
          const val = e.target.value === "" ? null : Number(e.target.value);
          const next = [...(s.answers[q.id] || blankResponse(q))];
          next[promptIdx] = val;
          setAnswer(s, q, next);
        },
      }, [ce("option", { value: "" }, "-- Select --")]);
      q.displayTargets.forEach((origIdx) => {
        const opt = ce("option", { value: String(origIdx) }, q.targets[origIdx]);
        if (response[promptIdx] === origIdx) opt.setAttribute("selected", "selected");
        select.appendChild(opt);
      });
      box.appendChild(ce("div", { class: "matching-row" }, [ce("span", { class: "matching-prompt" }, promptText), select]));
    });
  },

  ordering(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, "Use the arrows to arrange the steps in the correct order (top = first)."));
    const order = s.answers[q.id] || blankResponse(q);
    const list = ce("div", { class: "order-list" });
    order.forEach((origIdx, pos) => {
      const row = ce("div", { class: "order-item" }, [
        ce("span", { class: "order-pos" }, String(pos + 1)),
        ce("span", { class: "order-text" }, q.items[origIdx]),
        ce("div", { class: "order-controls" }, [
          ce("button", {
            class: "btn-link",
            type: "button",
            ...(pos === 0 ? { disabled: "disabled" } : {}),
            onclick: () => {
              const next = [...order];
              [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
              setAnswer(s, q, next);
              renderExam();
            },
          }, "▲"),
          ce("button", {
            class: "btn-link",
            type: "button",
            ...(pos === order.length - 1 ? { disabled: "disabled" } : {}),
            onclick: () => {
              const next = [...order];
              [next[pos], next[pos + 1]] = [next[pos + 1], next[pos]];
              setAnswer(s, q, next);
              renderExam();
            },
          }, "▼"),
        ]),
      ]);
      list.appendChild(row);
    });
    box.appendChild(list);
  },

  fill_blank(q, s, box) {
    const response = s.answers[q.id] || blankResponse(q);
    const parts = q.question.split(BLANK_TOKEN);
    const para = ce("p", { class: "fill-blank-text" });
    parts.forEach((part, i) => {
      if (part) para.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        para.appendChild(
          ce("input", {
            type: "text",
            class: "blank-input",
            value: response[i] || "",
            oninput: (e) => {
              const next = [...(s.answers[q.id] || blankResponse(q))];
              next[i] = e.target.value;
              s.answers[q.id] = next; // no full re-render needed while typing
              renderPalette();
            },
          })
        );
      }
    });
    box.appendChild(para);
  },

  hotspot(q, s, box) {
    box.appendChild(ce("p", { class: "hint" }, "Click the zone(s) that answer the question."));
    const selected = new Set(s.answers[q.id] || []);
    const canvas = ce("div", { class: "hotspot-canvas" });
    q.zones.forEach((zone) => {
      const isSelected = selected.has(zone.id);
      const el2 = ce("button", {
        type: "button",
        class: `hotspot-zone ${isSelected ? "selected" : ""}`,
        style: `left:${zone.x}%; top:${zone.y}%; width:${zone.w}%; height:${zone.h}%;`,
        onclick: () => {
          const sel = new Set(s.answers[q.id] || []);
          if (sel.has(zone.id)) sel.delete(zone.id);
          else sel.add(zone.id);
          setAnswer(s, q, [...sel]);
          renderExam();
        },
      }, zone.label);
      canvas.appendChild(el2);
    });
    box.appendChild(canvas);
  },

  simulation(q, s, box) {
    const response = s.answers[q.id] || blankResponse(q);
    const table = ce("div", { class: "sim-table" });
    q.rows.forEach((row, i) => {
      let field;
      if (row.fieldType === "select") {
        field = ce("select", {
          onchange: (e) => {
            const next = [...(s.answers[q.id] || blankResponse(q))];
            next[i] = e.target.value || null;
            setAnswer(s, q, next);
          },
        }, [ce("option", { value: "" }, "-- Select --"), ...row.options.map((opt) => {
          const o = ce("option", { value: opt }, opt);
          if (response[i] === opt) o.setAttribute("selected", "selected");
          return o;
        })]);
      } else if (row.fieldType === "checkbox") {
        field = ce("input", {
          type: "checkbox",
          ...(response[i] ? { checked: "checked" } : {}),
          onchange: (e) => {
            const next = [...(s.answers[q.id] || blankResponse(q))];
            next[i] = e.target.checked;
            setAnswer(s, q, next);
          },
        });
      } else {
        field = ce("input", {
          type: "text",
          value: response[i] || "",
          oninput: (e) => {
            const next = [...(s.answers[q.id] || blankResponse(q))];
            next[i] = e.target.value;
            s.answers[q.id] = next;
            renderPalette();
          },
        });
      }
      table.appendChild(ce("div", { class: "sim-row" }, [ce("span", { class: "sim-label" }, row.label), field]));
    });
    box.appendChild(table);
  },
};

function renderPalette() {
  const s = state.session;
  const box = el("#question-palette");
  box.innerHTML = "";
  s.questions.forEach((q, i) => {
    const answered = hasAnyAnswer(q, s.answers[q.id]);
    const marked = s.marked.has(q.id);
    const btn = ce("button", {
      class: `palette-btn ${answered ? "answered" : ""} ${marked ? "marked" : ""} ${i === s.index ? "current" : ""}`,
      onclick: () => {
        s.index = i;
        renderExam();
      },
    }, String(i + 1));
    box.appendChild(btn);
  });
}

function finishExam() {
  stopTimer();
  const s = state.session;
  const unanswered = s.questions.filter((q) => !hasAnyAnswer(q, s.answers[q.id])).length;
  if (unanswered > 0 && s.endsAt && Date.now() < s.endsAt) {
    if (!confirm(`${unanswered} question(s) are unanswered. Submit anyway?`)) return;
  }
  const result = scoreSession(s.questions, s.answers);
  state.lastResult = result;
  state.session = null;
  showPage("page-results");
  renderResults(result);
}

// ----------------------------------------------------------------- Results

function renderResults(result) {
  el("#result-score").textContent = `${result.correctCount} / ${result.total} (${result.percent}%)`;
  el("#result-scaled").textContent = `Estimated scaled score: ${result.scaled} / ${EXAM_INFO.scaledScoreRange[1]} (illustrative — passing is ${EXAM_INFO.passingScaledScore})`;
  const passBadge = el("#result-pass");
  passBadge.textContent = result.passed ? "PASS (estimated)" : "FAIL (estimated)";
  passBadge.className = `badge-pass ${result.passed ? "pass" : "fail"}`;

  const domainTable = el("#domain-breakdown");
  domainTable.innerHTML = "";
  for (const [domainId, stat] of Object.entries(result.perDomain)) {
    if (stat.total === 0) continue;
    const pct = Math.round((stat.correct / stat.total) * 100);
    domainTable.appendChild(
      ce("div", { class: "breakdown-row" }, [
        ce("span", { class: "bd-label" }, `${domainId} ${stat.name}`),
        ce("div", { class: "bd-bar-bg" }, [ce("div", { class: "bd-bar", style: `width:${pct}%` })]),
        ce("span", { class: "bd-num" }, `${stat.correct}/${stat.total} (${pct}%)`),
      ])
    );
  }

  const reviewBox = el("#review-list");
  reviewBox.innerHTML = "";
  let showOnlyIncorrect = el("#review-filter-incorrect").checked;
  renderReviewDetails(result, showOnlyIncorrect);

  el("#review-filter-incorrect").onchange = (e) => renderReviewDetails(result, e.target.checked);

  el("#retake-missed-btn").onclick = () => retakeMissed(result);
  el("#export-json-btn").onclick = () => exportResultsJSON(result);
  el("#export-csv-btn").onclick = () => exportResultsCSV(result);
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timestampForFilename() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

// Human-readable answer summaries, used by both exports so PBQ types (matching,
// ordering, fill_blank, hotspot, simulation) export as legibly as plain MCQ.
function describeCorrectAnswer(q) {
  switch (q.type) {
    case "matching":
      return q.prompts.map((p, i) => `${p} → ${q.targets[q.answer[i]]}`).join(" | ");
    case "ordering":
      return q.items.join(" → ");
    case "fill_blank":
      return q.blanks.map((b, i) => `Blank ${i + 1}: ${b.accepted[0]}`).join(" | ");
    case "hotspot":
      return q.answer.map((id) => q.zones.find((z) => z.id === id)?.label || id).join(" | ");
    case "simulation":
      return q.rows.map((r) => `${r.label}: ${r.fieldType === "checkbox" ? (r.answer ? "Checked" : "Unchecked") : r.answer}`).join(" | ");
    default:
      return q.answer.map((i) => q.options[i]).join(" | ");
  }
}

function describeYourAnswer(q, selected) {
  switch (q.type) {
    case "matching":
      return q.prompts.map((p, i) => `${p} → ${selected[i] != null ? q.targets[selected[i]] : "(no answer)"}`).join(" | ");
    case "ordering": {
      const order = selected && selected.length === q.items.length ? selected : q.items.map((_, i) => i);
      return order.map((idx) => q.items[idx]).join(" → ");
    }
    case "fill_blank":
      return q.blanks.map((b, i) => `Blank ${i + 1}: ${(selected[i] || "").trim() || "(blank)"}`).join(" | ");
    case "hotspot":
      return selected.length ? selected.map((id) => q.zones.find((z) => z.id === id)?.label || id).join(" | ") : "(no answer)";
    case "simulation":
      return q.rows
        .map((r, i) => {
          const val = selected[i];
          if (r.fieldType === "checkbox") return `${r.label}: ${val ? "Checked" : "Unchecked"}`;
          return `${r.label}: ${val || "(no answer)"}`;
        })
        .join(" | ");
    default:
      return selected.length ? selected.map((i) => q.options[i]).join(" | ") : "(no answer)";
  }
}

function exportResultsJSON(result) {
  const payload = {
    examVersion: "SY0-701",
    generatedAt: new Date().toISOString(),
    summary: {
      correct: result.correctCount,
      total: result.total,
      percent: result.percent,
      estimatedScaledScore: result.scaled,
      passed: result.passed,
    },
    perDomain: result.perDomain,
    perObjective: result.perObjective,
    questions: result.details.map((d) => ({
      id: d.question.id,
      domain: d.question.domain,
      type: d.question.type,
      question: d.question.question,
      correctAnswer: describeCorrectAnswer(d.question),
      yourAnswer: describeYourAnswer(d.question, d.selected),
      rawCorrectAnswer: d.question.answer ?? null,
      rawYourAnswer: d.selected,
      correct: d.correct,
      explanation: d.question.explanation || "",
    })),
  };
  downloadFile(`sy0-701-results-${timestampForFilename()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportResultsCSV(result) {
  const header = ["id", "domain", "objective", "type", "question", "correct_answer", "your_answer", "result", "explanation"];
  const rows = result.details.map((d) => {
    const q = d.question;
    return [
      q.id,
      q.domain,
      OBJECTIVE_INDEX[q.domain]?.title || "",
      PBQ_TYPE_LABELS[q.type] || q.type,
      q.question.replaceAll(BLANK_TOKEN, "____"),
      describeCorrectAnswer(q),
      describeYourAnswer(q, d.selected),
      d.correct ? "correct" : "incorrect",
      q.explanation || "",
    ];
  });
  const summaryLine = [`Score`, `${result.correctCount}/${result.total} (${result.percent}%)`, "", "", "", "", "", "", ""];
  const csv = [header, summaryLine, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  downloadFile(`sy0-701-results-${timestampForFilename()}.csv`, csv, "text/csv");
}

const REVIEW_BODY_RENDERERS = {
  choice(q, selected) {
    const optList = ce("ul", { class: "review-options" });
    q.options.forEach((optText, idx) => {
      const isCorrectOpt = q.answer.includes(idx);
      const wasSelected = selected.includes(idx);
      let cls = "";
      if (isCorrectOpt) cls = "opt-correct";
      if (wasSelected && !isCorrectOpt) cls = "opt-wrong-selected";
      optList.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${optText}${isCorrectOpt ? " (correct)" : ""}`));
    });
    return optList;
  },

  matching(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.prompts.forEach((promptText, i) => {
      const correctTarget = q.targets[q.answer[i]];
      const yourTarget = selected[i] != null ? q.targets[selected[i]] : "(no answer)";
      const ok = selected[i] === q.answer[i];
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${promptText} → your answer: ${yourTarget}${ok ? "" : ` (correct: ${correctTarget})`}`)
      );
    });
    return list;
  },

  ordering(q, selected) {
    const list = ce("ol", { class: "review-options" });
    const order = selected && selected.length === q.items.length ? selected : q.items.map((_, i) => i);
    order.forEach((origIdx, pos) => {
      const ok = origIdx === pos;
      list.appendChild(ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, q.items[origIdx]));
    });
    if (!order.every((v, i) => v === i)) {
      const correctList = ce("ol", { class: "review-options" });
      q.items.forEach((text) => correctList.appendChild(ce("li", { class: "opt-correct" }, text)));
      return ce("div", {}, [ce("p", { class: "hint" }, "Your order:"), list, ce("p", { class: "hint" }, "Correct order:"), correctList]);
    }
    return list;
  },

  fill_blank(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.blanks.forEach((b, i) => {
      const val = (selected[i] || "").trim();
      const ok = b.accepted.some((a) => a.trim().toLowerCase() === val.toLowerCase());
      list.appendChild(
        ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `Blank ${i + 1}: "${val || "(blank)"}" ${ok ? "" : `(accepted: ${b.accepted.join(", ")})`}`)
      );
    });
    return list;
  },

  hotspot(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.zones.forEach((zone) => {
      const isCorrectZone = q.answer.includes(zone.id);
      const wasSelected = (selected || []).includes(zone.id);
      let cls = "";
      if (isCorrectZone) cls = "opt-correct";
      if (wasSelected && !isCorrectZone) cls = "opt-wrong-selected";
      list.appendChild(ce("li", { class: cls }, `${wasSelected ? "☑" : "☐"} ${zone.label}${isCorrectZone ? " (correct)" : ""}`));
    });
    return list;
  },

  simulation(q, selected) {
    const list = ce("ul", { class: "review-options" });
    q.rows.forEach((row, i) => {
      const val = selected[i];
      let ok, yourText, correctText;
      if (row.fieldType === "checkbox") {
        ok = Boolean(val) === Boolean(row.answer);
        yourText = val ? "Checked" : "Unchecked";
        correctText = row.answer ? "Checked" : "Unchecked";
      } else if (row.fieldType === "text") {
        ok = typeof val === "string" && val.trim().toLowerCase() === String(row.answer).trim().toLowerCase();
        yourText = val || "(blank)";
        correctText = row.answer;
      } else {
        ok = val === row.answer;
        yourText = val || "(no answer)";
        correctText = row.answer;
      }
      list.appendChild(ce("li", { class: ok ? "opt-correct" : "opt-wrong-selected" }, `${row.label}: ${yourText}${ok ? "" : ` (correct: ${correctText})`}`));
    });
    return list;
  },
};

function renderReviewDetails(result, onlyIncorrect) {
  const reviewBox = el("#review-list");
  reviewBox.innerHTML = "";
  result.details
    .filter((d) => !onlyIncorrect || !d.correct)
    .forEach((d) => {
      const q = d.question;
      const item = ce("div", { class: `review-item ${d.correct ? "correct" : "incorrect"}` });
      item.appendChild(ce("div", { class: "review-head" }, [
        ce("span", { class: "obj-code" }, q.domain),
        ce("span", {}, PBQ_TYPE_LABELS[q.type] || ""),
        ce("span", {}, d.correct ? "✓ Correct" : "✗ Incorrect"),
      ]));
      item.appendChild(ce("div", { class: "review-question" }, q.question.replaceAll(BLANK_TOKEN, "____")));
      const renderBody = REVIEW_BODY_RENDERERS[q.type] || REVIEW_BODY_RENDERERS.choice;
      item.appendChild(renderBody(q, d.selected));
      if (q.explanation) item.appendChild(ce("div", { class: "review-explanation" }, q.explanation));
      reviewBox.appendChild(item);
    });
}

function retakeMissed(result) {
  const missed = result.details.filter((d) => !d.correct).map((d) => d.question);
  if (missed.length === 0) {
    alert("No missed questions — great job!");
    return;
  }
  const questions = prepareSessionQuestions(missed, { shuffleOptions: true });
  state.session = {
    questions,
    answers: {},
    marked: new Set(),
    index: 0,
    timerEnabled: false,
    endsAt: null,
    timerId: null,
  };
  showPage("page-exam");
  renderExam();
}

// --------------------------------------------------------------------- Init

function wireNav() {
  elAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });
  el("#back-to-setup-btn").addEventListener("click", () => showPage("page-setup"));
}

function wireSetup() {
  el("#preset-standard-btn").addEventListener("click", applyStandardPreset);
  el("#select-all-domains").addEventListener("click", () => {
    allObjectiveIds().forEach((id) => state.selectedObjectives.add(id));
    renderDomainFilters();
    refreshPoolCount();
  });
  el("#select-no-domains").addEventListener("click", () => {
    state.selectedObjectives.clear();
    renderDomainFilters();
    refreshPoolCount();
  });
  el("#num-questions").addEventListener("input", refreshPoolCount);
  el("#start-exam-btn").addEventListener("click", startExam);
  ["#timer-toggle", "#timer-minutes", "#shuffle-questions", "#shuffle-options"].forEach((sel) => {
    el(sel).addEventListener("change", persistSettings);
  });

  el("#file-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
  });
}

function wireExam() {
  el("#prev-btn").addEventListener("click", () => {
    state.session.index = Math.max(0, state.session.index - 1);
    renderExam();
  });
  el("#next-btn").addEventListener("click", () => {
    state.session.index = Math.min(state.session.questions.length - 1, state.session.index + 1);
    renderExam();
  });
  el("#mark-review-btn").addEventListener("click", () => {
    const s = state.session;
    const q = s.questions[s.index];
    if (s.marked.has(q.id)) s.marked.delete(q.id);
    else s.marked.add(q.id);
    renderExam();
  });
  el("#finish-btn").addEventListener("click", finishExam);
  el("#quit-exam-btn").addEventListener("click", () => {
    if (confirm("Quit this exam attempt without scoring? Progress will be lost.")) {
      stopTimer();
      state.session = null;
      showPage("page-setup");
    }
  });
}

function wireInstructions() {
  el("#copy-prompt-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(UPLOAD_FORMAT_DOC);
      el("#copy-prompt-btn").textContent = "Copied!";
      setTimeout(() => (el("#copy-prompt-btn").textContent = "Copy full instructions + prompt"), 1500);
    } catch {
      alert("Could not copy automatically — please select and copy the text manually.");
    }
  });
  el("#download-example-btn").addEventListener("click", downloadExample);
}

export function initApp() {
  state.sets = loadUploadedSets();
  applySavedSettings(loadSettings());
  wireNav();
  wireSetup();
  wireExam();
  wireInstructions();
  renderSetsPanel();
  renderDomainFilters();
  renderInstructions();
  refreshPoolCount();
  showPage("page-setup");
}
