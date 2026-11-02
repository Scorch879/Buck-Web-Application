/**
 * Buck_AI's default Gemini fallback chain, best first, for the admin overview.
 * A copy of DEFAULT_GEMINI_MODELS in Buck_AI/shared/config.py: Buck_AI's health
 * endpoint does not report its configuration, so the web app cannot ask for it.
 * `buckAiModels.test.ts` fails when the two lists drift apart. A deployment that
 * sets GEMINI_MODELS uses its own chain; the admin page's model breakdown (from
 * saved advice) shows which models actually answered.
 */
export const BUCK_AI_DEFAULT_GEMINI_MODELS: readonly string[] = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-lite-latest",
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
];

export const BUCK_AI_FALLBACK_ENGINE = "buck-rule-advisor (deterministic rule engine)";
