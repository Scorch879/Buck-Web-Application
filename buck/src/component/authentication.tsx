"use client";
import { useState } from "react";
import { auth, db } from "@/utils/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

type FormData = {
  username: string;
  pass: string;
  confirm: string;
  email: string;
};

export function useSignUp() {
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