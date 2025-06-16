"use client";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import "./style.css";
import { signInUser, signInWithGoogle } from "@/component/authentication";
import { useState } from "react";
import { Header, Footer } from "@/component/HeaderFooter";
import { motion } from "framer-motion";

const SignInSignUp = (): React.JSX.Element => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  const handleSignIn = async () => {
    const result = await signInUser(email, pass);
    if (result.success) {
      alert("Sign in successful!");
      // Optionally redirect or update UI here
    } else {
      alert(result.message || "Sign in failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      alert("Google sign in successful!");
      // Optionally redirect or update UI here
    } else {
      alert(result.message || "Google sign in failed.");
    }
  };  

  return (
    <>
      <Header />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="sign-in-sign-up"
      >
        <div className="overlap-wrapper">
          <div className="overlap">
            <div className="BG-inner-rect" />
            <div className="BG-outer-rect" />
            <div className="main-panel">
              <div className="text-input-layer">
                <Link
                  href="/create-account"
                  className="text-wrapper"
                >
                  Create an Account
                </Link>

                <Link href="/forgot-password" className="div">Forgot Password</Link>

                <div className="text-wrapper-2">Password</div>

                <div className="text-wrapper-3">Email</div>

                <input type="password" value={pass} onChange={e => setPass(e.target.value)}  className="password-box" placeholder="Password" />
                
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="username-box" placeholder="Email" />
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
                    priority
                  />
                </div>
              </div>

              <button className="google-btn" onClick={handleGoogleSignIn}>
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

              <button onClick={handleSignIn} className="sign-in-btn">
                <div className="div-wrapper">
                  <div className="text-wrapper-5">Sign In</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      <Footer />
    </>
  );
};

export default SignInSignUp;
