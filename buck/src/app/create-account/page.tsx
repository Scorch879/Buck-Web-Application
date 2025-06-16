"use client";
import React, { useState } from "react";
import Image from "next/image";
import "./style.css";

const CreateAccount = (): React.JSX.Element => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
        <form className="ca-form">
          <label htmlFor="username" className="ca-label">
            Username
          </label>
          <input
            id="username"
            className="ca-input"
            type="text"
            placeholder="Username"
          />

          <label htmlFor="email" className="ca-label">
            Email Address
          </label>
          <input
            id="email"
            className="ca-input"
            type="email"
            placeholder="Email Address"
          />

          <label htmlFor="password" className="ca-label">
            Password
          </label>
          <div className="ca-password-wrapper">
            <input
              id="password"
              className="ca-input"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
            />
            <button
              type="button"
              className="ca-toggle-btn"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <Image
                src={showPassword ? "/duck-eye-closed.png" : "/duck-eye.png"}
                alt={showPassword ? "Hide password" : "Show password"}
                width={24}
                height={24}
                style={{ display: "block" }}
              />
            </button>
          </div>

          <label htmlFor="confirm-password" className="ca-label">
            Confirm Password
          </label>
          <div className="ca-password-wrapper">
            <input
              id="confirm-password"
              className="ca-input"
              type={showConfirm ? "text" : "password"}
              placeholder="Confirm Password"
            />
            <button
              type="button"
              className="ca-toggle-btn"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              <Image
                src={showConfirm ? "/duck-eye-closed.png" : "/duck-eye.png"}
                alt={showConfirm ? "Hide password" : "Show password"}
                width={24}
                height={24}
                style={{ display: "block" }}
              />
            </button>
          </div>

          <button type="submit" className="ca-btn">
            Create Account
          </button>
        </form>
        <button className="ca-google-btn">
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
  );
};

export default CreateAccount;
