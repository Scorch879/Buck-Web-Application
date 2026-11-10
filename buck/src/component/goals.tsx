import { detectGoalAttitude, getGoalTip } from "@/utils/aiApi";
import { isSavingAttitude, type GoalAttitude, type SavingAttitude } from "@/utils/goalAttitude";
import {
  addGoalProgressRecord,
  createGoalRecord,
  deleteGoalRecord,
  setOnlyGoalActiveRecord,
  updateGoalRecord,
  updateGoalStatusRecord,
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
    const aiRecommendation = await getGoalTip({
      goalName,
      targetAmount,
      attitude: chosen,
      targetDate,
    });
    const goal = await createGoalRecord(
      goalName,
      targetAmount,
      chosen,
      targetDate,
      aiRecommendation,
      detected ? basisOf(detected) : null
    );

    return { success: true, goal, attitude: detected };
  } catch (error) {
    console.error("Failed to create goal:", error);
    return { success: false, message: "Failed to create goal." };
  }
}

export async function deleteGoal(goalId: string) {
  try {
    await deleteGoalRecord(goalId);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return { success: false, message: "Failed to delete goal." };
  }
}

export async function updateGoalStatus(goalId: string, isActive: boolean) {
  try {
    await updateGoalStatusRecord(goalId, isActive);
    return { success: true };
  } catch (error) {
    console.error("Failed to update goal status:", error);
    return { success: false, message: "Failed to update goal status." };
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

/** Adds to the saved amount atomically; reaching the target completes the goal. */
export async function addGoalProgress(goalId: string, amount: number) {
  try {
    const goal = await addGoalProgressRecord(goalId, amount);
    return { success: true, ...goal };
  } catch (error) {
    console.error("Failed to add goal progress:", error);
    return { success: false, message: "Failed to update progress." };
  }
}

export async function updateGoal(
  goalId: string,
  goalName: string,
  targetAmount: string,
  attitude: string,
  targetDate: string
) {
  try {
    // The amount or date may have changed, so the attitude it needs may too.
    const preview = await detectGoalAttitude({ targetAmount, targetDate });
    const chosen: SavingAttitude = preview?.attitude ?? (isSavingAttitude(attitude) ? attitude : "Normal");
    const aiRecommendation = await getGoalTip({
      goalName,
      targetAmount,
      attitude: chosen,
      targetDate,
    });
    await updateGoalRecord(goalId, goalName, targetAmount, chosen, targetDate, aiRecommendation);
    // Detect again from the saved goal (counts what is already saved) and store the basis.
    const detected = await detectGoalAttitude({ goalId });

    return { success: true, attitude: detected };
  } catch (error) {
    console.error("Failed to update goal:", error);
    return { success: false, message: "Failed to update goal." };
  }
}
