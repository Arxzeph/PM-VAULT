---
name: unslop
description: Generate a domain-specific text or visual profile by running Unslop, analyzing repeated AI defaults, and reviewing before/after output. Use when the user wants to profile a domain's AI patterns, not merely rewrite prose.
---

# unslop

Use this repo to empirically profile repeated AI defaults in a text or visual domain and generate a reusable `skill.md`.

## Workflow

1. Clone `https://github.com/mshumer/unslop` if the repo is not already present.
2. Enter the repo root and use a Python virtual environment.
3. Decide whether the job is `text` or `visual`.
   Text: writing, emails, essays, tutorials, copy, code explanations.
   Visual: websites, landing pages, HTML pages, UI mockups.
   This workflow produces a reusable profile for later use; it does not directly rewrite a user's prose.
4. Install Playwright only for visual runs:
   `pip install playwright && playwright install chromium`
5. Run the tool:
   `python3 unslop.py --domain "<domain>"`
   `python3 unslop.py --domain "<domain>" --type visual --count 20 --concurrency 3`

## Output Review

Check `unslop-output/analysis.md` and `unslop-output/skill.md`.

- `analysis.md` must be concrete, counted, and specific.
- `skill.md` should mostly say what to avoid, not prescribe one new stock style.
- For visual runs, compare `unslop-output/before-after/before.html` and `unslop-output/before-after/after.html`.
- The `after` result should feel meaningfully less generic than `before`.

Complete only when `analysis.md` and `skill.md` exist, and a visual run has a
before/after comparison or an explicit caveat explaining why it is missing.

If the analysis is thin or obviously missed repeated patterns, rerun or rewrite the analysis from inside `unslop-output` after reviewing the screenshots and sample files directly.

## Deliverable

Return:

- The generated `skill.md`
- The main repeated patterns the analysis found
- Any caveats about sample quality, missing screenshots, or weak comparison output
