import { auth, db } from "@/utils/firebase";
import { collection, addDoc } from "firebase/firestore";

export async function createGoal(goalName: string, targetAmount: string, attitude: string) {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    try {
        console.log(user.uid);
        await addDoc(collection(db, "goals", user.uid, "userGoals"), {
            goalName,
            targetAmount,
            attitude,
            createdAt: new Date()
        });
        return { success: true };
    }
    catch (error: any) {
        console.error("Sign up error:", error);
        return { success: false};
    }
}
