import { OBJECTIVE_INDEX } from "./data/objectives.js";

// Validates an uploaded question-set JSON object against the format described
// in the in-app "Instructions" panel (docs/QUESTION_FORMAT.md mirrors this).
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

    let id = typeof q.id === "string" && q.id.trim() ? q.id.trim() : `${setName}-${idx + 1}`;
    if (seenIds.has(id)) id = `${id}-dup${idx + 1}`;
    seenIds.add(id);

    if (typeof q.question !== "string" || !q.question.trim()) {
      errors.push(`${where}: "question" text is required.`);
      return;
    }

    const domain = typeof q.domain === "string" ? q.domain.trim() : "";
    if (!OBJECTIVE_INDEX[domain]) {
      errors.push(
        `${where}: "domain" must be one of the SY0-701 objective codes (e.g. "1.1", "2.4"), got ${JSON.stringify(q.domain)}.`
      );
      return;
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      errors.push(`${where}: "options" must be an array of at least 2 strings.`);
      return;
    }
    const options = q.options.map((o) => String(o));

    let type = q.type === "multiple" ? "multiple" : "single";

    if (!Array.isArray(q.answer) || q.answer.length === 0) {
      errors.push(`${where}: "answer" must be a non-empty array of option indices.`);
      return;
    }
    const answer = [...new Set(q.answer.map(Number))].filter((n) => Number.isInteger(n));
    if (answer.length !== new Set(q.answer.map(Number)).size || answer.some((n) => n < 0 || n >= options.length)) {
      errors.push(`${where}: "answer" indices must be integers within range of "options".`);
      return;
    }
    if (type === "single" && answer.length > 1) {
      warnings.push(`${where}: type "single" but multiple correct indices given; treating as "multiple".`);
      type = "multiple";
    }

    const explanation = typeof q.explanation === "string" ? q.explanation : "";
    const difficulty = ["easy", "medium", "hard"].includes(q.difficulty) ? q.difficulty : undefined;

    normalizedQuestions.push({ id, domain, type, question: q.question.trim(), options, answer, explanation, difficulty });
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
