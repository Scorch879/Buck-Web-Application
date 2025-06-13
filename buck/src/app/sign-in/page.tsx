"use client";
import React from "react";
import Image from "next/image";
import "./style.css";

export const SignInSignUp = (): React.ReactElement => {
  return (
    <div className="sign-in-sign-up">
      <div className="overlap-wrapper">
        <div className="overlap">
          <div className="BG-inner-rect" />

          <div className="BG-outer-rect" />

          <div className="tab-layer">
            <div className="lower-rect" />

            <div className="overlap-group">
              <div className="buttons">
                <div className="sign-up">
                  <div className="text">GO BACK</div>
                </div>
              </div>
            </div>
          </div>

          <div className="orange-rect" />

          <div className="duck-image">
            <div className="div">
              <div className="ellipse" />

              <Image
                className="duck-rect-shape"
                alt="Duck rect shape"
                src="/BuckMascot.png"
                width={200}
                height={200}
              />
            </div>
          </div>

          <div className="text-layer">
            <div className="text-wrapper">Create an Account</div>

            <div className="text-wrapper-2">Forget Password</div>

            <div className="text-wrapper-3">Password</div>

            <div className="text-wrapper-4">Username</div>

            <p className="p">Incorrect email or password. Please try again</p>

            <div className="input-box" />

            <div className="input-box-2" />
          </div>

          <div className="sign-in-btn">
            <div className="div-wrapper">
              <div className="text-wrapper-5">Sign In</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignInSignUp; // ← ✅ This is what Next.js expects!