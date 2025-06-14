"use client";
import { useState } from 'react';

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
     if(form.username === "" || form.pass === "" || form.email === "") {
      alert("Please fill in all fields");
      return;
    }
    // Validation logic
    if (form.pass !== form.confirm) {
      alert("Passwords do not match");
      return;
    }

    if (!emailRegex.test(form.email)) {
      alert("Please enter a valid email address");
      return;
    }

   


    // Here you would typically send the form data to your backend
    // ...other logic (API calls, etc.)...

    alert("Sign up successful!");
  };

  return {
    form, 
    handleChange, 
    handleSubmit
  };
}