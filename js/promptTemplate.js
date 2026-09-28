// Text shown in the in-app "Instructions" panel and copyable to clipboard, so a user
// can paste it into an LLM (ChatGPT, Claude, etc.) to generate a compatible question set.
export const UPLOAD_FORMAT_DOC = `SY0-701 Exam Simulator — question set upload format
=====================================================

Upload a single JSON file shaped like this:

{
  "setName": "My generated set — Domain 2 practice",
  "examVersion": "SY0-701",
  "description": "Optional free text.",
  "questions": [ ... see the 6 question TYPES below ... ]
}

Every question object shares these fields:
- id (string, optional): unique within the file. Auto-generated if omitted.
- domain (string, REQUIRED): one SY0-701 objective code. Must be exactly one of:
    1.1  1.2  1.3  1.4
    2.1  2.2  2.3  2.4  2.5
    3.1  3.2  3.3  3.4
    4.1  4.2  4.3  4.4  4.5  4.6  4.7  4.8  4.9
    5.1  5.2  5.3  5.4  5.5  5.6
- type (string, optional): one of "single", "multiple", "matching", "ordering",
  "fill_blank", "hotspot", "simulation". Defaults to "single".
- question (string, REQUIRED): the question stem / instructions.
- explanation (string, optional but recommended): shown after grading.
- difficulty (string, optional): "easy" | "medium" | "hard".

------------------------------------------------------------------
TYPE 1 & 2 — "single" / "multiple" (standard multiple choice)
------------------------------------------------------------------
{
  "type": "single",
  "domain": "2.4",
  "question": "Which of the following is the BEST indicator of a password-spraying attack?",
  "options": [
    "A single account with many failed logins in one minute",
    "Many accounts, each with one or two failed logins, in a short window",
    "A successful login from a new geographic location",
    "A user resetting their own password"
  ],
  "answer": [1],
  "explanation": "Password spraying tries few passwords across many accounts to avoid lockouts."
}
- options (array of strings, REQUIRED): at least 2 choices.
- answer (array of integers, REQUIRED): zero-based indices into "options" that are
  correct. One index for "single", two or more for "multiple".

------------------------------------------------------------------
TYPE 3 — "matching"  (PBQ: drag/select each item to its correct match)
------------------------------------------------------------------
{
  "type": "matching",
  "domain": "1.1",
  "question": "Match each example to the security control TYPE it represents.",
  "prompts": ["A fence around the building", "A written AUP policy", "An IDS appliance"],
  "targets": ["Physical", "Managerial", "Technical", "Operational"],
  "answer": [0, 1, 2],
  "explanation": "..."
}
- prompts (array of strings, REQUIRED, 2+): left-hand items.
- targets (array of strings, REQUIRED): right-hand choices. May include extra
  distractor targets beyond prompts.length.
- answer (array of integers, REQUIRED, same length as "prompts"): for each prompt
  (by position), the zero-based index into "targets" that is correct.

------------------------------------------------------------------
TYPE 4 — "ordering"  (PBQ: arrange steps into the correct sequence)
------------------------------------------------------------------
{
  "type": "ordering",
  "domain": "4.8",
  "question": "Arrange the incident response phases in the correct order.",
  "items": ["Preparation", "Detection and analysis", "Containment", "Eradication", "Recovery", "Lessons learned"],
  "explanation": "..."
}
- items (array of strings, REQUIRED, 3+): list the steps IN THE CORRECT ORDER.
  The app shuffles them for display and scores whether the test-taker restores
  this exact order. No separate "answer" field is needed.

------------------------------------------------------------------
TYPE 5 — "fill_blank"  (PBQ: type the missing term/command)
------------------------------------------------------------------
{
  "type": "fill_blank",
  "domain": "1.2",
  "question": "The three pillars of the CIA triad are Confidentiality, ____, and Availability.",
  "blanks": [ { "accepted": ["Integrity"] } ],
  "explanation": "..."
}
- The "question" text must contain exactly one "____" (four underscores) token per
  blank, in order, marking where each input box appears.
- blanks (array, REQUIRED, one entry per "____" token): each entry has "accepted",
  a non-empty array of acceptable strings (matched case-insensitively, trimmed).
  Include common synonyms/abbreviations, e.g. ["Integrity"] or ["MFA", "multifactor authentication"].
- For multiple blanks: "... ____ uses a ____ and a ____ ..." needs blanks.length === 3.

------------------------------------------------------------------
TYPE 6 — "hotspot"  (PBQ: click the correct zone(s) of an abstract diagram)
------------------------------------------------------------------
{
  "type": "hotspot",
  "domain": "3.2",
  "question": "Click the zone where the public web server should be placed.",
  "zones": [
    { "id": "z_internal", "label": "Internal LAN (trusted)", "x": 4,  "y": 25, "w": 27, "h": 50 },
    { "id": "z_dmz",       "label": "DMZ",                   "x": 36.5, "y": 25, "w": 27, "h": 50 },
    { "id": "z_internet",  "label": "Internet (untrusted)",  "x": 69, "y": 25, "w": 27, "h": 50 }
  ],
  "answer": ["z_dmz"],
  "explanation": "..."
}
- zones (array, REQUIRED, 2+): labeled rectangles on an abstract canvas. x/y/w/h are
  PERCENTAGES (0-100) of the canvas width/height (x,y = top-left corner). No image
  file is needed — the app renders these as labeled clickable boxes.
- answer (array of strings, REQUIRED): the zone id(s) that are correct (supports
  single or multi-zone answers).

------------------------------------------------------------------
TYPE 7 — "simulation"  (PBQ: configure a table of settings, e.g. firewall ACL)
------------------------------------------------------------------
{
  "type": "simulation",
  "domain": "3.2",
  "question": "Configure inbound rules for a default-deny policy that allows only HTTPS.",
  "rows": [
    { "label": "TCP 443 inbound from any", "fieldType": "select", "options": ["Allow", "Deny"], "answer": "Allow" },
    { "label": "TCP 23 (Telnet) inbound from any", "fieldType": "select", "options": ["Allow", "Deny"], "answer": "Deny" },
    { "label": "Enable logging on this appliance", "fieldType": "checkbox", "answer": true },
    { "label": "Management VLAN ID", "fieldType": "text", "answer": "99" }
  ],
  "explanation": "..."
}
- rows (array, REQUIRED, 2+): one row per configurable item.
  - label (string, REQUIRED).
  - fieldType (REQUIRED): "select" (needs "options", array of 2+ strings, and
    "answer" = one of those strings), "checkbox" (needs "answer" = true/false),
    or "text" (needs "answer" = the expected string, matched case-insensitively).

Rules
-----
1. The file must be valid JSON (UTF-8), a single object with a top-level "questions" array.
2. Every "domain" value must match one of the 28 objective codes above exactly.
3. Mix any number/combination of the 7 types and any number of questions per objective —
   the app can combine several uploaded sets and filter/mix them at exam time.

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
- Use a mix of question types: mostly "single"/"multiple" (standard multiple choice),
  plus include some performance-based question (PBQ) types where they fit the
  objective naturally — "matching" (pairing terms/examples to categories),
  "ordering" (sequencing a process), "fill_blank" (typing a key term),
  "hotspot" (clicking the correct zone of an abstract diagram), and "simulation"
  (configuring a small table of settings, e.g. firewall rules or log review).
  Aim for roughly [PBQ_RATIO, e.g. "1 in 5"] questions to be a PBQ type.
- Every question object must include: id, domain (one of the objective codes
  above, exactly), type, question, explanation, difficulty ("easy"/"medium"/"hard"),
  plus the type-specific fields documented below.

Field reference for each type
- single / multiple: "options" (array of 4 plausible choices) + "answer" (zero-based
  index array into options; one index for single, 2+ for multiple).
- matching: "prompts" (2+ strings) + "targets" (strings, may include 1-2 distractors
  beyond prompts.length) + "answer" (one target-index per prompt, same order as prompts).
- ordering: "items" (3-6 strings) listed IN THE CORRECT ORDER — no separate answer field.
- fill_blank: "question" must contain one "____" (4 underscores) per blank, plus
  "blanks" (array of { "accepted": [acceptable strings/synonyms] }, one per "____").
- hotspot: "zones" (2-5 objects with unique "id", "label", and x/y/w/h as 0-100
  percentages of an abstract canvas, non-overlapping) + "answer" (array of the
  correct zone id(s)).
- simulation: "rows" (2-6 objects with "label" and "fieldType": "select" needs
  "options" + "answer" from those options; "checkbox" needs "answer" true/false;
  "text" needs "answer" as the expected string).

Do not reuse the exact wording of official CompTIA exam questions; write original
scenarios that test the same objective. Ensure the JSON is syntactically valid
(no trailing commas, all strings quoted, hotspot zones must not overlap).
"""

Tips for the [LIST OBJECTIVE CODES] blank
------------------------------------------
- Whole domain: 2.1, 2.2, 2.3, 2.4, 2.5   (all of Domain 2.0)
- Partial range: 1.1, 1.2, 1.3            (Domain 1.0 minus 1.4)
- Cross-domain mix: 4.6, 4.8, 5.2, 5.5    (IAM + IR + risk + audits)
`;

export const UPLOAD_FORMAT_EXAMPLE = {
  setName: "Example set — one of each question type",
  examVersion: "SY0-701",
  description: "Minimal examples covering every supported question type.",
  questions: [
    {
      id: "ex-single",
      domain: "1.4",
      type: "single",
      question: "Which technology manages the issuance and revocation of digital certificates?",
      options: ["PKI", "SIEM", "SOAR", "MDM"],
      answer: [0],
      explanation: "PKI (public key infrastructure) issues, manages, and revokes certificates.",
      difficulty: "easy",
    },
    {
      id: "ex-multiple",
      domain: "4.6",
      type: "multiple",
      question: "Which of the following are examples of authentication factors? (Select TWO)",
      options: ["A password", "A job title", "A fingerprint scan", "A department name"],
      answer: [0, 2],
      explanation: "A password (something you know) and a fingerprint (something you are) are authentication factors.",
      difficulty: "medium",
    },
    {
      id: "ex-matching",
      domain: "1.1",
      type: "matching",
      question: "Match each example to the security control TYPE it represents.",
      prompts: ["A fence around the building", "A written acceptable-use policy", "An IDS appliance"],
      targets: ["Physical", "Managerial", "Technical", "Operational"],
      answer: [0, 1, 2],
      explanation: "Physical = tangible barrier, Managerial = policy, Technical = enforced by systems.",
      difficulty: "medium",
    },
    {
      id: "ex-ordering",
      domain: "4.8",
      type: "ordering",
      question: "Arrange the incident response phases in the correct order.",
      items: ["Preparation", "Detection and analysis", "Containment", "Eradication", "Recovery"],
      explanation: "Standard NIST-style incident response lifecycle order.",
      difficulty: "medium",
    },
    {
      id: "ex-fill-blank",
      domain: "1.2",
      type: "fill_blank",
      question: "The three pillars of the CIA triad are Confidentiality, ____, and Availability.",
      blanks: [{ accepted: ["Integrity"] }],
      explanation: "Integrity ensures data has not been altered by an unauthorized party.",
      difficulty: "easy",
    },
    {
      id: "ex-hotspot",
      domain: "3.2",
      type: "hotspot",
      question: "Click the zone where a public-facing web server should be placed.",
      zones: [
        { id: "z_internal", label: "Internal LAN (trusted)", x: 4, y: 25, w: 27, h: 50 },
        { id: "z_dmz", label: "DMZ", x: 36.5, y: 25, w: 27, h: 50 },
        { id: "z_internet", label: "Internet (untrusted)", x: 69, y: 25, w: 27, h: 50 },
      ],
      answer: ["z_dmz"],
      explanation: "The DMZ isolates internet-facing services from the trusted internal LAN.",
      difficulty: "medium",
    },
    {
      id: "ex-simulation",
      domain: "3.2",
      type: "simulation",
      question: "Configure inbound rules for a default-deny policy that allows only HTTPS.",
      rows: [
        { label: "TCP 443 inbound from any", fieldType: "select", options: ["Allow", "Deny"], answer: "Allow" },
        { label: "TCP 23 (Telnet) inbound from any", fieldType: "select", options: ["Allow", "Deny"], answer: "Deny" },
      ],
      explanation: "A default-deny posture only opens the single required, encrypted service.",
      difficulty: "medium",
    },
  ],
};
