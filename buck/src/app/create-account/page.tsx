"use client";
import React from "react";
import Image from "next/image";
import "./style.css";

const CreateAccount = (): React.JSX.Element => {
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
          <label htmlFor="username" className="ca-label">Username</label>
          <input id="username" className="ca-input" type="text" placeholder="Username" />

          <label htmlFor="email" className="ca-label">Email Address</label>
          <input id="email" className="ca-input" type="email" placeholder="Email Address" />

          <label htmlFor="password" className="ca-label">Password</label>
          <input id="password" className="ca-input" type="password" placeholder="Password" />

          <label htmlFor="confirm-password" className="ca-label">Confirm Password</label>
          <input id="confirm-password" className="ca-input" type="password" placeholder="Confirm Password" />

          <button type="submit" className="ca-btn">Create Account</button>
        </form>
        <button className="ca-google-btn">
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