"use client";
import { useState } from "react";
import React from "react";
import Image from "next/image";
import { signInWithGoogle, signUpUser } from "@/component/authentication";
import { motion } from "framer-motion";
import "./style.css";

const CreateAccount = () => {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [btnMouse, setBtnMouse] = useState<{ x: number; y: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="ca-bg"
    >
      <div className="background">
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
          <form
            className="ca-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAccount();
            }}
          >
            <label htmlFor="username" className="ca-label">
              Username
            </label>
            <input
              id="username"
              className="ca-input"
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />

            <label htmlFor="email" className="ca-label">
              Email Address *
            </label>
            <input
              id="email"
              className="ca-input"
              type="email"
              placeholder="Email Address"
              value={form.email}
              onChange={handleChange}
            />

            <label htmlFor="password" className="ca-label">
              Password *
            </label>
            <div className="ca-input-wrapper">
              <input
                id="password"
                className="ca-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ca-eye-btn"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Image
                  src={showPassword ? "/duck-eye.png" : "/duck-eye-closed.png"}
                  alt={showPassword ? "Hide password" : "Show password"}
                  width={24}
                  height={24}
                />
              </button>
            </div>

            <label htmlFor="confirm" className="ca-label">
              Confirm Password *
            </label>
            <div className="ca-input-wrapper">
              <input
                id="confirm"
                className="ca-input"
                type={showConfirm ? "text" : "password"}
                placeholder="Confirm Password"
                value={form.confirm}
                onChange={handleChange}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ca-eye-btn"
                tabIndex={-1}
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                <Image
                  src={showConfirm ? "/duck-eye.png" : "/duck-eye-closed.png"}
                  alt={showConfirm ? "Hide password" : "Show password"}
                  width={24}
                  height={24}
                />
              </button>
            </div>

            <motion.button
              ref={btnRef}
              type="submit"
              className="ca-btn"
              onMouseMove={e => {
                const rect = btnRef.current?.getBoundingClientRect();
                if (rect) {
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  setBtnMouse({ x, y });
                }
              }}
              onMouseLeave={() => setBtnMouse(null)}
              style={{
                background: btnMouse
                  ? `radial-gradient(circle at ${btnMouse.x}px ${btnMouse.y}px, #fd523b 0%, #ef8a57 100%)`
                  : "linear-gradient(90deg, #ef8a57 60%, #fd523b 100%)",
                transition: btnMouse ? "background 0.1s" : "background 0.3s",
              }}
              whileHover={{
                scale: 1.03,
              }}
            >
              Create Account
            </motion.button>

            {message && <div className="success-message">{message}</div>}
            {error && <div className="error-message">{error}</div>}
          </form>
          <button className="ca-google-btn" onClick={handleGoogleSignIn}>
            <Image
              src="/Google.png"
              alt="Google"
              width={20}
              height={20}
              className="ca-google-icon"
            />
            Sign up with Google
          </button>
          <div className="ca-footer">
            Already have an account?{" "}
            <a href="/sign-in" className="ca-link">
              Sign In
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CreateAccount;
