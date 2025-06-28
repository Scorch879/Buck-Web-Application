// In goals.tsx
import { addDoc, collection, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/utils/firebase";

export async function createGoal(goalName: string, targetAmount: string, attitude: string, targetDate: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  try {
    // Call backend to get AI recommendation
    const aiResponse = await fetch('https://buck-web-application-1.onrender.com/ai/saving_tip/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: goalName,
        user_context: `Attitude: ${attitude}, Target Amount: ${targetAmount}`
      })
    });
    let aiRecommendation = '';
    if (aiResponse.ok) {
      const data = await aiResponse.json();
      aiRecommendation = data.tip || '';
    }
    const docRef = await addDoc(collection(db, "goals", user.uid, "userGoals"), {
      goalName,
      targetAmount,
      attitude,
      createdAt: new Date().toISOString().slice(0, 10),
      targetDate,
      isActive: false,
      aiRecommendation // Save the AI recommendation
    });
    return {
      success: true,
      goal: {
        id: docRef.id,
        goalName,
        targetAmount,
        attitude,
        createdAt: new Date().toISOString().slice(0, 10),
        targetDate,
        isActive: false,
        aiRecommendation
      }
    };
  } catch (error) {
    return { success: false };
  }
}

export async function deleteGoal(goalId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  try {
    await deleteDoc(doc(db, "goals", user.uid, "userGoals", goalId));
    return { success: true };
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return { success: false, message: "Failed to delete goal." };
  }
}

export async function updateGoal(goalId: string, goalName: string, targetAmount: string, attitude: string, targetDate: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  try {
    // Call backend to get updated AI recommendation
    const aiResponse = await fetch('https://buck-web-application-1.onrender.com/ai/saving_tip/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: goalName,
        user_context: `Attitude: ${attitude}, Target Amount: ${targetAmount}`
      })
    });
    let aiRecommendation = '';
    if (aiResponse.ok) {
      const data = await aiResponse.json();
      aiRecommendation = data.tip || '';
    }
    await setDoc(doc(db, "goals", user.uid, "userGoals", goalId), {
      goalName,
      targetAmount,
      attitude,
      targetDate,
      isActive: false,
      aiRecommendation,
      updatedAt: new Date().toISOString().slice(0, 10)
    }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}