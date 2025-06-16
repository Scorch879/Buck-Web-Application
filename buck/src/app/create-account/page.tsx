"use client";
import React from "react";
import Image from "next/image";
import "./style.css";

const CreateAccount = (): React.JSX.Element => {
  return (
    <div className="create-account">
      <div className="inner-rect" />

      <div className="outer-rect" />

      <div className="create-acc-panel">
        <div className="overlap">
          <div className="overlap-group">
            <div className="div">
              <div className="input-box">
                <label className="input-label" htmlFor="username">Username</label>
                <input id="username" className="input-field" type="text" placeholder="Username" />

                <label className="input-label" htmlFor="email">Email Address</label>
                <input id="email" className="input-field" type="email" placeholder="Email Address" />

                <label className="input-label" htmlFor="password">Password</label>
                <input id="password" className="input-field" type="password" placeholder="Password" />

                <label className="input-label" htmlFor="confirm-password">Confirm Password</label>
                <input id="confirm-password" className="input-field" type="password" placeholder="Confirm Password" />
              </div>

              <div className="duck-image">
                <div className="overlap-2">
                  <div className="ellipse" />

                  <Image
                    className="duck-rect-shape"
                    alt="Duck rect shape"
                    src="/BuckMascot.png"
                    width={98}
                    height={107}
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="h">Create Account</div>
          </div>

          <div className="google-btn">
            <div className="div-wrapper">
              <div className="text-wrapper-2">Google</div>
            </div>
          </div>

          <div className="create-account-btn">
            <div className="div-wrapper">
              <div className="text-wrapper-2">Create Account</div>
            </div>
          </div>

          <p className="sign-in-text">
            <span className="span">Already have an account?</span>

            <span className="text-wrapper-3">&nbsp;</span>

            <span className="text-wrapper-3">Sign In</span>
          </p>

          <Image className="buck-logo" alt="Buck logo" src="/Buck Logo.png" width={200} height={50} priority />
        </div>
      </div>
    </div>
  );
};

export default CreateAccount;
