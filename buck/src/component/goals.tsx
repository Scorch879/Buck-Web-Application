// In goals.tsx
import { addDoc, collection, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "@/utils/firebase";

export async function createGoal(goalName: string, targetAmount: string, attitude: string, targetDate: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  try {
    const docRef = await addDoc(collection(db, "goals", user.uid, "userGoals"), {
      goalName,
      targetAmount,
      attitude,
      createdAt: new Date().toISOString().slice(0, 10),
      targetDate,
      isActive: false
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
        isActive: false
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