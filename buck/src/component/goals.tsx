import {
  createGoalRecord,
  deleteGoalRecord,
  setOnlyGoalActiveRecord,
  updateGoalRecord,
  updateGoalStatusRecord,
} from "@/utils/supabaseData";

async function getGoalRecommendation(
  goalName: string,
  targetAmount: string,
  attitude: string
) {
  try {
    const aiResponse = await fetch(
      "https://buck-web-application.onrender.com/ai/saving_tip/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: goalName,
          user_context: `Attitude: ${attitude}, Target Amount: ${targetAmount}`,
        }),
      }
    );

    if (!aiResponse.ok) {
      return "";
    }

    const data = await aiResponse.json();
    return typeof data.tip === "string" ? data.tip : "";
  } catch {
    return "";
  }
}

export async function createGoal(
  goalName: string,
  targetAmount: string,
  attitude: string,
  targetDate: string
) {
  try {
    const aiRecommendation = await getGoalRecommendation(
      goalName,
      targetAmount,
      attitude
    );
    const goal = await createGoalRecord(
      goalName,
      targetAmount,
      attitude,
      targetDate,
      aiRecommendation
    );

    return { success: true, goal };
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

export async function setOnlyGoalActive(goalId: string) {
  try {
    await setOnlyGoalActiveRecord(goalId);
    return { success: true };
  } catch (error) {
    console.error("Failed to update goals:", error);
    return { success: false, message: "Failed to update goals." };
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
    const aiRecommendation = await getGoalRecommendation(
      goalName,
      targetAmount,
      attitude
    );
    await updateGoalRecord(
      goalId,
      goalName,
      targetAmount,
      attitude,
      targetDate,
      aiRecommendation
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to update goal:", error);
    return { success: false, message: "Failed to update goal." };
  }
}
