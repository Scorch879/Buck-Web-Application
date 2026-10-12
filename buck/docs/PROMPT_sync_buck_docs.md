# Task: Reconcile the stale `buck/docs/` mirrors with the root specs

You are the **Senior QA & Documentation Engineer** for the Buck repository (see `Claude.md` section 4.1). Follow the **Zero Hallucination Policy**: every statement you write must be traceable to code, migrations or the root docs in this repo. Do not invent features.

## Background
Both the repo root and `buck/docs/` hold copies of five documents. The root copies are the maintained ones; the `buck/docs/` copies have drifted badly (for example `buck/docs/QA_Report.md` is about 278 lines behind the root copy).

| Root (source of truth) | Stale mirror |
|---|---|
| `Agents.md` | `buck/docs/Agents.md` |
| `Skills.md` | `buck/docs/Skills.md` |
| `Design.md` | `buck/docs/Design.md` |
| `Implementation.md` | `buck/docs/Implementation.md` |
| `QA_Report.md` | `buck/docs/QA_Report.md` |

`buck/docs/` also contains `README.md`, `SRS.md`, `Buck_SRS.docx`, `SUPABASE_EMAIL_TEMPLATES.txt` and `admin-backend-caching.md`. **Do not touch those** except where listed in step 4.

## Steps
1. For each pair, run `git diff --no-index <mirror> <root>` and read the whole diff. Check `git log -- <path>` on both so you know which side is newer.
2. Decide per pair, and **report your decision before editing**:
   - If the mirror holds no content that is missing from the root, replace it with the root copy.
   - If the mirror holds unique content (for example sections or ADRs the root lacks), list it and ask me whether to merge it into the root first.
3. Preserve line endings. The repo uses CRLF on Windows; do not create whole-file diffs from newline changes.
4. In `buck/docs/admin-backend-caching.md`, line ~26 hardcodes the admin e-mail address. Change it to say admin access is granted by `app_metadata.role = 'admin'` or the `ADMIN_EMAIL` environment variable (see `buck/src/utils/adminAccess.ts`).
5. Verify, do not assume:
   - Every file link in the copied docs resolves. Absolute `file:///d:/VS%20Code/...` links point at the root files, which is fine; relative links must be checked.
   - `Skills.md` lists the real FastAPI endpoints in `buck/BuckAI_Backend/main.py` and the real Next.js routes under `buck/src/app/api/`. **The Python service is about to be redesigned, so do not audit or edit `.py` files**; if the FastAPI table disagrees with `main.py`, report it to me instead of "fixing" either side.
6. Do not commit. Show me `git diff --stat` and a short list of anything you were unsure about.

## Constraints
- Docs only: no changes to source, migrations or config.
- Currency is Philippine Peso (PHP / the peso sign); the project schedule is capped at 9 weeks (`Claude.md` section 6.8). Do not contradict either.
- If a document and the code disagree, the code wins; log the discrepancy in the root `QA_Report.md` rather than silently rewriting history.
