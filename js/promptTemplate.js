// Text shown in the in-app "Instructions" panel and copyable to clipboard, so a user
// can paste it into an LLM (ChatGPT, Claude, etc.) to generate a compatible question set.
export const UPLOAD_FORMAT_DOC = `SY0-701 Exam Simulator — question set upload format
=====================================================

Upload a single JSON file shaped like this:

{
  "setName": "My generated set — Domain 2 practice",
  "examVersion": "SY0-701",
  "description": "Optional free text.",
  "questions": [
    {
      "id": "d2-001",
      "domain": "2.4",
      "type": "single",
      "question": "Which of the following is the BEST indicator of a password-spraying attack?",
      "options": [
        "A single account with many failed logins in one minute",
        "Many accounts, each with one or two failed logins, in a short window",
        "A successful login from a new geographic location",
        "A user resetting their own password"
      ],
      "answer": [1],
      "explanation": "Password spraying tries few passwords across many accounts to avoid lockouts.",
      "difficulty": "medium"
    }
  ]
}

Field reference
----------------
- setName (string, optional): display name for this set.
- examVersion (string, optional): informational only, defaults to "SY0-701".
- description (string, optional).
- questions (array, REQUIRED, non-empty). Each item:
  - id (string, optional): unique within the file. Auto-generated if omitted.
  - domain (string, REQUIRED): one SY0-701 objective code. Must be exactly one of:
      1.1  1.2  1.3  1.4
      2.1  2.2  2.3  2.4  2.5
      3.1  3.2  3.3  3.4
      4.1  4.2  4.3  4.4  4.5  4.6  4.7  4.8  4.9
      5.1  5.2  5.3  5.4  5.5  5.6
  - type (string, optional): "single" or "multiple". Defaults to "single".
  - question (string, REQUIRED): the question stem.
  - options (array of strings, REQUIRED): at least 2 answer choices.
  - answer (array of integers, REQUIRED): zero-based indices into "options" that are
    correct. One index for "single", two or more for "multiple".
  - explanation (string, optional but recommended): shown after grading.
  - difficulty (string, optional): "easy" | "medium" | "hard".

Rules
-----
1. The file must be valid JSON (UTF-8), a single object with a top-level "questions" array.
2. Every "domain" value must match one of the 28 objective codes above exactly (no
   spaces, no domain title text) — this is what powers the domain/objective filters.
3. "answer" indices must be within range of "options" and contain no duplicates.
4. Any number of questions per objective is fine; the app can combine several
   uploaded sets and filter/mix them at exam time.

------------------------------------------------------------------
Prompt you can paste into an LLM to generate a compatible file
------------------------------------------------------------------
Copy everything below (use the "Copy prompt" button) into ChatGPT, Claude, or
another LLM, filling in the bracketed parts, to get a ready-to-upload file.

"""
Generate a CompTIA Security+ SY0-701 practice question set as a single JSON file
for a web-based exam simulator. Output ONLY valid JSON, no markdown fences, no
commentary before or after.

Requirements:
- Top-level object with keys: setName, examVersion, description, questions.
- examVersion must be "SY0-701".
- questions must be an array of [NUMBER] objects.
- Cover these objective codes: [LIST OBJECTIVE CODES, e.g. 2.1, 2.2, 2.3, 2.4, 2.5]
  distributing questions evenly across them unless told otherwise.
- Each question object must have exactly these fields:
  - id: a short unique string
  - domain: one of the objective codes above, EXACTLY as given (e.g. "2.4")
  - type: "single" (one correct answer) or "multiple" (two or more correct answers)
  - question: a realistic, scenario-style Security+ exam question (avoid trivia;
    prefer "given a scenario" phrasing where appropriate)
  - options: an array of 4 plausible answer choices (or more for "multiple")
  - answer: a zero-based array of indices into "options" that are correct
  - explanation: 1-3 sentences explaining why the correct answer(s) are right and,
    briefly, why the main distractor is wrong
  - difficulty: "easy", "medium", or "hard"
- Do not reuse the exact wording of official CompTIA exam questions; write original
  scenarios that test the same objective.
- Ensure JSON is syntactically valid (no trailing commas, all strings quoted).
"""

Tips for the [LIST OBJECTIVE CODES] blank
------------------------------------------
- Whole domain: 2.1, 2.2, 2.3, 2.4, 2.5   (all of Domain 2.0)
- Partial range: 1.1, 1.2, 1.3            (Domain 1.0 minus 1.4)
- Cross-domain mix: 4.6, 4.8, 5.2, 5.5    (IAM + IR + risk + audits)
`;

export const UPLOAD_FORMAT_EXAMPLE = {
  setName: "Example mini set",
  examVersion: "SY0-701",
  description: "Two-question example matching the required schema.",
  questions: [
    {
      id: "ex-1",
      domain: "1.4",
      type: "single",
      question: "Which technology manages the issuance and revocation of digital certificates?",
      options: ["PKI", "SIEM", "SOAR", "MDM"],
      answer: [0],
      explanation: "PKI (public key infrastructure) issues, manages, and revokes certificates.",
      difficulty: "easy",
    },
    {
      id: "ex-2",
      domain: "4.6",
      type: "multiple",
      question: "Which of the following are examples of authentication factors? (Select TWO)",
      options: ["A password", "A job title", "A fingerprint scan", "A department name"],
      answer: [0, 2],
      explanation: "A password (something you know) and a fingerprint (something you are) are authentication factors; job title and department are not.",
      difficulty: "medium",
    },
  ],
};
