"use client";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import "./style.css";

export const SignInSignUp = (): React.JSX.Element => {
  return (
    <div className="sign-in-sign-up">
      <div className="overlap-wrapper">
        <div className="overlap">
          <div className="BG-inner-rect" />

          <div className="BG-outer-rect" />

          <div className="main-panel">
            <div className="text-input-layer">
              <div className="text-wrapper">Create an Account</div>

              <Link href="/forgot-password" className="div">Forgot Password</Link>

              <div className="text-wrapper-2">Password</div>

              <div className="text-wrapper-3">Username</div>

              

              <input type="password" className="password-box" placeholder="Password" />

              <input type="text" className="username-box" placeholder="Username" />
            </div>

            <div className="duck-image">
              <div className="overlap-group">
                <div className="ellipse" />
                <Image
                  className="duck-rect-shape"
                  alt="Duck rect shape"
                  src="/BuckMascot.png"
                  width={98}
                  height={107}
                  priority // optional, loads image ASAP
                />
              </div>
            </div>

            <button className="google-btn" onClick={() => console.log('Google sign in clicked')}>
              <div className="overlap-2">
                <div className="text-wrapper-4">Google Sign In</div>

                <Image
                  className="google"
                  alt="Google"
                  src="/google.png"
                  width={20}
                  height={20}
                  priority
                />
              </div>
            </button>

            <button className="sign-in-btn" onClick={() => console.log('Sign in clicked')}>
              <div className="div-wrapper">
                <div className="text-wrapper-5">Sign In</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInSignUp; 
