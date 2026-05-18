"use client";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { auth, db } from "@/utils/firebase";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

type AuthFormData = {
  username: string;
  pass: string;
  confirm: string;
  email: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function SignInSignUp() {
  const [form, setForm] = useState<AuthFormData>({
    username: "",
    pass: "",
    confirm: "",
    email: ""
  });

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
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
    } catch (error) {
      alert(getErrorMessage(error));
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
    if (username) {
      await updateProfile(userCredential.user, { displayName: username });
    }
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error("Sign up error:", error);
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, user: userCredential.user };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
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
      return { success: false, cancelled: true };
    }

    return { success: false, message: getErrorMessage(error) };
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
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}
