import { detectGoalAttitude, getGoalTip } from "@/utils/aiApi";
import { isSavingAttitude, type GoalAttitude, type SavingAttitude } from "@/utils/goalAttitude";
import {
  createGoalRecord,
  setOnlyGoalActiveRecord,
} from "@/utils/supabaseData";

/**
 * Goal actions for the Goals page. The saving attitude is detected by the AI
 * Financial Advisor (`detectGoalAttitude`), not picked by hand: an `attitude`
 * argument is only used when Buck_AI can't be reached.
 */

function basisOf(detected: GoalAttitude) {
  // Everything but the attitude itself and the response-only fields.
  const { attitude, goalId, plan, window, ...basis } = detected;
  return basis;
}

export async function createGoal(
  goalName: string,
  targetAmount: string,
  attitude: string,
  targetDate: string
) {
  try {
    const detected = await detectGoalAttitude({ targetAmount, targetDate });
    const chosen: SavingAttitude = detected?.attitude ?? (isSavingAttitude(attitude) ? attitude : "Normal");
    // Saved without a tip: the Advisor's two-sentence tip comes from Gemini, which can
    // take many seconds when busy. Buck_AI writes it onto the goal
    // (`goals.ai_recommendation`) once ready, so creating never waits for it.
    const goal = await createGoalRecord(
      goalName,
      targetAmount,
      chosen,
      targetDate,
      "",
      detected ? basisOf(detected) : null
    );
    void getGoalTip({ goalId: goal.id });

    return { success: true, goal, attitude: detected };
  } catch (error) {
    console.error("Failed to create goal:", error);
    return { success: false, message: "Failed to create goal." };
  }
}

/** Makes this the one active goal (one transaction) and refreshes its attitude. */
export async function setOnlyGoalActive(goalId: string) {
  try {
    await setOnlyGoalActiveRecord(goalId);
    const attitude = await detectGoalAttitude({ goalId });
    return { success: true, attitude };
  } catch (error) {
    console.error("Failed to update goals:", error);
    return { success: false, message: "Failed to update goals." };
  }
}
