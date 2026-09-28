# SY0-701 Exam Simulator

A static, client-side web app for practicing the CompTIA Security+ (SY0-701)
exam structure. No backend, no build step — just HTML/CSS/vanilla JS ES
modules, served as static files.

## Features

- Standardized SY0-701 structure: 5 domains, 28 objectives, official domain
  weights (`js/data/objectives.js`).
- Filter questions by whole domain, individual objectives, or a range within
  a domain (e.g. type `1.1-1.3` to select those objectives and exclude `1.4`).
- Take an exam on a single domain, several domains, or a custom cross-domain
  mix of objectives.
- Combine multiple question sets (the built-in sample set plus any number of
  uploaded sets) into one pool for a single exam session.
- Upload your own LLM-generated question sets as JSON, with schema
  validation and an in-app prompt template for generating compatible files
  (Instructions tab).
- Timed or untimed mode, question/answer shuffling, a "standard full exam"
  preset (90 questions / 90 minutes, official domain weighting), a question
  palette (jump/mark for review), per-domain score breakdown, and a
  "retake missed questions" flow.
- Performance-based questions (PBQs), not just multiple choice: matching,
  ordering/sequencing, fill-in-the-blank, hotspot (click the correct zone of
  an abstract diagram), and simulation (configure a table of settings, e.g.
  firewall rules) — see `js/promptTemplate.js` / the Instructions tab for the
  schema of each type.
- Setup filters and exam options persist in `localStorage` across reloads,
  and results can be exported as JSON or CSV.

## Running locally

Because the app uses ES modules (`import`/`export`), open it through a local
HTTP server rather than double-clicking `index.html` (browsers block module
imports from `file://`).

```bash
cd exam-sim
python3 -m http.server 8000
# then open http://localhost:8000
```

Any other static server (`npx serve`, `php -S`, etc.) works the same way.

## Deploying

The app is fully static — deploy the repository as-is to GitHub Pages,
Netlify, Vercel, S3, or any static host. There is no server-side component
and no build step.

## Uploading your own question sets

See the **Instructions & Upload Format** tab in the app for the full JSON
schema and a ready-to-paste LLM prompt that generates compatible files. In
short, a set is:

```json
{
  "setName": "My set",
  "questions": [
    {
      "domain": "2.4",
      "type": "single",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "answer": [1],
      "explanation": "..."
    }
  ]
}
```

`type` also supports five PBQ formats — `matching`, `ordering`, `fill_blank`,
`hotspot`, and `simulation` — each with its own fields (documented in full in
the app's Instructions tab). `domain` must be one of the 28 official
objective codes (`1.1`–`5.6`).
Uploaded sets are validated on import and stored in the browser's
`localStorage`, so they persist across reloads on the same device/browser
but are not shared between devices.

## Disclaimer

This is an unofficial, educational practice tool. It is not affiliated with,
endorsed by, or sourced from CompTIA. All bundled sample questions are
original content written to test the same objectives as the real exam.
