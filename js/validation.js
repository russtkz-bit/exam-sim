import { OBJECTIVE_INDEX } from "./data/objectives.js";

const VALID_TYPES = new Set(["single", "multiple", "matching", "ordering", "fill_blank", "hotspot", "simulation"]);
export const BLANK_TOKEN = "____"; // four underscores mark a fill_blank input inside "question"

function commonFields(q, idx, setName, seenIds) {
  let id = typeof q.id === "string" && q.id.trim() ? q.id.trim() : `${setName}-${idx + 1}`;
  if (seenIds.has(id)) id = `${id}-dup${idx + 1}`;
  seenIds.add(id);

  const domain = typeof q.domain === "string" ? q.domain.trim() : "";
  const explanation = typeof q.explanation === "string" ? q.explanation : "";
  const difficulty = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : undefined;
  const question = typeof q.question === "string" ? q.question.trim() : "";

  return { id, domain, explanation, difficulty, question };
}

// Each validator returns either { ok: true, fields } or { ok: false, error }.
const TYPE_VALIDATORS = {
  choice(q, where) {
    // covers "single" and "multiple"
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { ok: false, error: `${where}: "options" must be an array of at least 2 strings.` };
    }
    const options = q.options.map((o) => String(o));
    let type = q.type === "multiple" ? "multiple" : "single";

    if (!Array.isArray(q.answer) || q.answer.length === 0) {
      return { ok: false, error: `${where}: "answer" must be a non-empty array of option indices.` };
    }
    const uniqueRaw = new Set(q.answer.map(Number));
    const answer = [...uniqueRaw].filter((n) => Number.isInteger(n));
    if (answer.length !== uniqueRaw.size || answer.some((n) => n < 0 || n >= options.length)) {
      return { ok: false, error: `${where}: "answer" indices must be integers within range of "options".` };
    }
    if (type === "single" && answer.length > 1) type = "multiple";
    return { ok: true, fields: { type, options, answer }, warning: type === "multiple" && q.type === "single" ? `${where}: type "single" but multiple correct indices given; treated as "multiple".` : null };
  },

  matching(q, where) {
    if (!Array.isArray(q.prompts) || q.prompts.length < 2) {
      return { ok: false, error: `${where}: "prompts" must be an array of at least 2 strings.` };
    }
    if (!Array.isArray(q.targets) || q.targets.length < q.prompts.length) {
      return { ok: false, error: `${where}: "targets" must have at least as many entries as "prompts".` };
    }
    const prompts = q.prompts.map((p) => String(p));
    const targets = q.targets.map((t) => String(t));
    if (!Array.isArray(q.answer) || q.answer.length !== prompts.length) {
      return { ok: false, error: `${where}: "answer" must be an array with one target index per prompt.` };
    }
    const answer = q.answer.map(Number);
    if (answer.some((n) => !Number.isInteger(n) || n < 0 || n >= targets.length)) {
      return { ok: false, error: `${where}: "answer" indices must be integers within range of "targets".` };
    }
    return { ok: true, fields: { type: "matching", prompts, targets, answer } };
  },

  ordering(q, where) {
    if (!Array.isArray(q.items) || q.items.length < 3) {
      return { ok: false, error: `${where}: "items" must be an array of at least 3 strings, given in the correct order.` };
    }
    return { ok: true, fields: { type: "ordering", items: q.items.map((i) => String(i)) } };
  },

  fill_blank(q, where, question) {
    if (!Array.isArray(q.blanks) || q.blanks.length === 0) {
      return { ok: false, error: `${where}: "blanks" must be a non-empty array.` };
    }
    const blanks = [];
    for (const b of q.blanks) {
      const accepted = Array.isArray(b?.accepted) ? b.accepted.map((a) => String(a)).filter((a) => a.trim()) : [];
      if (accepted.length === 0) {
        return { ok: false, error: `${where}: each entry in "blanks" needs a non-empty "accepted" array of strings.` };
      }
      blanks.push({ accepted });
    }
    const tokenCount = question.split(BLANK_TOKEN).length - 1;
    if (tokenCount !== blanks.length) {
      return {
        ok: false,
        error: `${where}: "question" must contain exactly ${blanks.length} "${BLANK_TOKEN}" placeholder(s) to match "blanks" (found ${tokenCount}).`,
      };
    }
    return { ok: true, fields: { type: "fill_blank", blanks } };
  },

  hotspot(q, where) {
    if (!Array.isArray(q.zones) || q.zones.length < 2) {
      return { ok: false, error: `${where}: "zones" must be an array of at least 2 zone objects.` };
    }
    const zones = [];
    const zoneIds = new Set();
    for (const z of q.zones) {
      const id = typeof z?.id === "string" && z.id.trim() ? z.id.trim() : null;
      const label = typeof z?.label === "string" ? z.label.trim() : "";
      const nums = ["x", "y", "w", "h"].map((k) => Number(z?.[k]));
      if (!id || zoneIds.has(id) || !label || nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
        return {
          ok: false,
          error: `${where}: each zone needs a unique "id", a "label", and x/y/w/h numbers between 0 and 100 (percent of the canvas).`,
        };
      }
      zoneIds.add(id);
      zones.push({ id, label, x: nums[0], y: nums[1], w: nums[2], h: nums[3] });
    }
    if (!Array.isArray(q.answer) || q.answer.length === 0 || q.answer.some((a) => !zoneIds.has(a))) {
      return { ok: false, error: `${where}: "answer" must be a non-empty array of zone ids that exist in "zones".` };
    }
    return { ok: true, fields: { type: "hotspot", zones, answer: q.answer.map(String) } };
  },

  simulation(q, where) {
    if (!Array.isArray(q.rows) || q.rows.length < 2) {
      return { ok: false, error: `${where}: "rows" must be an array of at least 2 row objects.` };
    }
    const rows = [];
    for (const r of q.rows) {
      const label = typeof r?.label === "string" ? r.label.trim() : "";
      const fieldType = ["select", "checkbox", "text"].includes(r?.fieldType) ? r.fieldType : null;
      if (!label || !fieldType) {
        return { ok: false, error: `${where}: each row needs a "label" and a "fieldType" of "select", "checkbox", or "text".` };
      }
      if (fieldType === "select") {
        if (!Array.isArray(r.options) || r.options.length < 2) {
          return { ok: false, error: `${where}: row "${label}" (select) needs an "options" array of at least 2 strings.` };
        }
        const options = r.options.map((o) => String(o));
        if (typeof r.answer !== "string" || !options.includes(r.answer)) {
          return { ok: false, error: `${where}: row "${label}" (select) "answer" must be one of its "options".` };
        }
        rows.push({ label, fieldType, options, answer: r.answer });
      } else if (fieldType === "checkbox") {
        rows.push({ label, fieldType, answer: Boolean(r.answer) });
      } else {
        if (typeof r.answer !== "string" || !r.answer.trim()) {
          return { ok: false, error: `${where}: row "${label}" (text) needs a non-empty string "answer".` };
        }
        rows.push({ label, fieldType, answer: r.answer.trim() });
      }
    }
    return { ok: true, fields: { type: "simulation", rows } };
  },
};

// Validates an uploaded question-set JSON object against the format described
// in the in-app "Instructions" panel. Supports plain multiple-choice plus five
// standardized PBQ-style formats: matching, ordering, fill_blank, hotspot, simulation.
// Returns { valid, errors, warnings, set } where `set` is normalized (only present if valid).
export function validateQuestionSet(raw, sourceLabel = "uploaded file") {
  const errors = [];
  const warnings = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: [`${sourceLabel}: root must be a JSON object.`], warnings, set: null };
  }
  if (!Array.isArray(raw.questions) || raw.questions.length === 0) {
    return { valid: false, errors: [`${sourceLabel}: "questions" must be a non-empty array.`], warnings, set: null };
  }

  const setName = typeof raw.setName === "string" && raw.setName.trim() ? raw.setName.trim() : sourceLabel;
  const examVersion = typeof raw.examVersion === "string" ? raw.examVersion : "SY0-701";
  const description = typeof raw.description === "string" ? raw.description : "";

  const seenIds = new Set();
  const normalizedQuestions = [];

  raw.questions.forEach((q, idx) => {
    const where = `question #${idx + 1}`;
    if (!q || typeof q !== "object") {
      errors.push(`${where}: must be an object.`);
      return;
    }

    const { id, domain, explanation, difficulty, question } = commonFields(q, idx, setName, seenIds);

    if (!question) {
      errors.push(`${where}: "question" text is required.`);
      return;
    }
    if (!OBJECTIVE_INDEX[domain]) {
      errors.push(
        `${where}: "domain" must be one of the SY0-701 objective codes (e.g. "1.1", "2.4"), got ${JSON.stringify(q.domain)}.`
      );
      return;
    }

    const requestedType = VALID_TYPES.has(q.type) ? q.type : "single";
    const validatorKey = requestedType === "single" || requestedType === "multiple" ? "choice" : requestedType;
    const result = TYPE_VALIDATORS[validatorKey](q, where, question);

    if (!result.ok) {
      errors.push(result.error);
      return;
    }
    if (result.warning) warnings.push(result.warning);

    normalizedQuestions.push({ id, domain, question, explanation, difficulty, ...result.fields });
  });

  if (normalizedQuestions.length === 0) {
    errors.push(`${sourceLabel}: no valid questions could be parsed.`);
    return { valid: false, errors, warnings, set: null };
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    set: { setName, examVersion, description, questions: normalizedQuestions },
  };
}
