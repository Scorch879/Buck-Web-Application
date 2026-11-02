import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BUCK_AI_DEFAULT_GEMINI_MODELS } from "./buckAiModels";

describe("Buck_AI model list", () => {
  it("matches DEFAULT_GEMINI_MODELS in Buck_AI/shared/config.py", () => {
    const config = readFileSync(resolve(__dirname, "../../../Buck_AI/shared/config.py"), "utf8");
    const block = /DEFAULT_GEMINI_MODELS = \(([\s\S]*?)\)/.exec(config)?.[1] ?? "";
    const models = [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);

    expect(models.length).toBeGreaterThan(0);
    expect(BUCK_AI_DEFAULT_GEMINI_MODELS).toEqual(models);
  });
});
