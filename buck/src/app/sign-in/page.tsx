"use client";
import Image from "next/image";
import React from "react";
import Link from "next/link";
import "./style.css";
import { signInUser, signInWithGoogle } from "@/component/authentication";
import { useState } from "react";
import { Header, Footer } from "@/component/HeaderFooter";
import { motion } from "framer-motion";

const SignIn = (): React.JSX.Element => {
    const [email, setEmail] = useState("");
    const [pass, setPass] = useState("");
    const [error, setError] = useState("");
    const [btnMouse, setBtnMouse] = useState<{ x: number; y: number } | null>(null);
    const btnRef = React.useRef<HTMLButtonElement>(null);

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    const handleSignIn = async () => {
        setError("");
        if (!email || !pass) {
            alert("Please enter both email and password.");
            return;
        }
        if (!validateEmail(email)) {
            alert("Please enter a valid email address.");
            return;
        }
        if (pass.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }
        const result = await signInUser(email, pass);
        if (result.success) {
            alert("Sign in successful!");
            // Redirect or update UI here
        } else {
            alert(result.message || "Sign in failed.");
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
            className="SI-Background"
        >
            <div className="background">
                <div className="SI-Container">
                    <div className="SI-Mascot-Top">
                        <div className="SI-Mascot-Circle">
                            <Image
                                src="/BuckMascot.png"
                                alt="Buck Mascot"
                                width={70}
                                height={100}
                                className="SI-Mascot-Img"
                                priority
                            />
                        </div>
                    </div>
                    <h2 className="SI-Title">Sign In</h2>
                    <form className="SI-Form">
                        <label htmlFor="username" className="SI-Label">
                            Email/Username
                        </label>
                        <input
                            id="username"
                            className="SI-Input"
                            type="text"
                            placeholder="Email/Username"
                        />

                        <label htmlFor="password" className="SI-Label">
                            Password
                        </label>
                        <input
                            id="password"
                            className="SI-Input"
                            type="password"
                            placeholder="Password"
                        />
                        <motion.button
                            ref={btnRef}
                            type="submit"
                            className="SI-Btn"
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
                            Sign In
                        </motion.button>
                    </form>
                    <button className="SI-Google-Btn" onClick={handleGoogleSignIn}>
                        <Image
                            src="/Google.png"
                            alt="Google"
                            width={20}
                            height={20}
                            className="SI-Google-Icon"
                        />
                        Sign In with Google
                    </button>
                    <div className="SI-Footer">
                        Don't have an account?{" "}
                        <a href="/create-account" className="SI-Link">
                            Create Account
                        </a>
                    </div>

                </div>
            </div>
        </motion.div >


    );
}

export default SignIn;