"use client";
import { useState } from "react";
import React from "react";
import Image from "next/image";
import { signInWithGoogle, signUpUser } from "@/component/authentication";
import "./style.css";

const CreateAccount = () => {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleCreateAccount = async () => {
    setError("");
    setMessage("");
    if (
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.confirm.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    const result = await signUpUser(form.email, form.password, form.username);
    if (result.success) {
      setMessage("Account created! You can now sign in.");
      setForm({ username: "", email: "", password: "", confirm: "" });
    } else {
      setError(result.message || "Account creation failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      alert("Google Sign-In successful!");
    } else if (result.cancelled) {
      // Do nothing, user cancelled
    } else {
      alert(result.message || "Google Sign-In failed.");
    }
  };

  return (
    <div className="ca-bg">
      <div className="ca-card">
        <div className="ca-mascot-top">
          <div className="ca-mascot-circle">
            <Image
              src="/BuckMascot.png"
              alt="Buck Mascot"
              width={70}
              height={100}
              className="ca-mascot-img"
              priority
            />
          </div>
        </div>
        <h2 className="ca-title">Create Account</h2>
        <form className="ca-form" onSubmit={e => { e.preventDefault(); handleCreateAccount(); }}>
          <label htmlFor="username" className="ca-label">Username</label>
          <input id="username" className="ca-input" type="text" placeholder="Username" value={form.username} onChange={handleChange} />

          <label htmlFor="email" className="ca-label">Email Address *</label>
          <input id="email" className="ca-input" type="email" placeholder="Email Address" value={form.email} onChange={handleChange} />

          <label htmlFor="password" className="ca-label">Password *</label>
          <input id="password" className="ca-input" type="password" placeholder="Password" value={form.password} onChange={handleChange} />

          <label htmlFor="confirm" className="ca-label">Confirm Password *</label>
          <input id="confirm" className="ca-input" type="password" placeholder="Confirm Password" value={form.confirm} onChange={handleChange} />

          <button type="submit" className="ca-btn">Create Account</button>

          {message && <div className="success-message">{message}</div>}
          {error && <div className="error-message">{error}</div>}
        </form>
        <button className="ca-google-btn" onClick={handleGoogleSignIn}>
          <Image src="/Google.png" alt="Google" width={20} height={20} className="ca-google-icon" />
          Sign up with Google
        </button>
        <div className="ca-footer">
          Already have an account? <a href="/sign-in" className="ca-link">Sign In</a>
        </div>
      </div>
    </div>
  );
};

export default CreateAccount;