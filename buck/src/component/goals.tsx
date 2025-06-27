import { auth, db } from "@/utils/firebase";
import { collection, addDoc, doc, setDoc,getDocs } from "firebase/firestore";

//to check if the user has goals or no
export async function isUserGoalsEmpty() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const goalsRef = collection(db, "goals", user.uid, "userGoals");
  const snapshot = await getDocs(goalsRef);

  return snapshot.empty; // true if empty, false if not
}

export async function createGoal(goalName: string, targetAmount: string, attitude: string, targetDate: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    try {
        // Add goal to userGoals subcollection
        await addDoc(collection(db, "goals", user.uid, "userGoals"), {
            goalName,
            targetAmount,
            createdAt: new Date().toISOString().slice(0, 10),
            targetDate,
            isActive: false //
        });

        // Update attitude in the parent document (goals/{user.uid})
        await setDoc(doc(db, "goals", user.uid), {
            attitude
        }, { merge: true });

        return { success: true };
    }
    catch (error: any) {
        console.error("something went wrong:", error);
        return { success: false };
    }
}