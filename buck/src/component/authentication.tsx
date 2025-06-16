"use client";
import { useState } from "react";
import { auth, db } from "@/utils/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { sendPasswordResetEmail } from "firebase/auth";

type FormData = {
  username: string;
  pass: string;
  confirm: string;
  email: string;
};

export function SignInSignUp() {
  const [form, setForm] = useState<FormData>({
    username: "",
    pass: "",
    confirm: "",
    email: ""
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.username === "" || form.pass === "" || form.email === "") {
      alert("Please fill in all fields");
      return;
    }
    if (form.pass !== form.confirm) {
      alert("Passwords do not match");
      return;
    }
    if (!emailRegex.test(form.email)) {
      alert("Please enter a valid email address");
      return;
    }

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.pass);
      const user = userCredential.user;

      // 2. Store additional user info in Firestore (not the password!)
      await setDoc(doc(db, "users", user.uid), {
        username: form.username,
        email: form.email,
        createdAt: new Date()
      });

      alert("Sign up successful!");
    } catch (error: any) {
      alert(error.message);
    }
  };


  return {
    form,
    handleChange,
    handleSubmit
  };
}

export async function signUpUser(email: string, password: string, username: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
    // Optionally set display name
    if (auth.currentUser && username) {
      await updateProfile(auth.currentUser, { displayName: username });
    }
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    console.error("Sign up error:", error);
    return { success: false, message: error.message };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    // result.user contains the signed-in user info
    return { success: true, user: result.user };
  }
  catch (error: any) {
    if (error.code === "auth/popup-closed-by-user") {
      return { success: false, cancelled: true }; //if user closed the popup it is treated as a cancellation of your life
    }

    return { success: false, message: error.message };
  }
}

/**
 * Sends a password reset email to the given address.
 * @param email The user's email address.
 * @returns {Promise<{success: boolean, message?: string}>}
 */

export async function sendPasswordReset(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true, message: "Password reset email sent!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}


