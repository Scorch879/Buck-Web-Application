"use client";
import React, { useState } from 'react';
import { Header, Footer } from '../../component/HeaderFooter';
import TextBox from '@/component/textBox';
import { useSignUp }  from "@/component/authentication";

export default function SignUp() {
 const { form, handleChange, handleSubmit } = useSignUp();

  return (
    <>
      <Header />
      <div className="mainStrip">
        <div className="darken animate-fade-bg">
          <div className="signupContainer animate-fade-in">
            <div id="buckCircle"></div>
            <p>Create Account</p>
            <form onSubmit={handleSubmit}>
              <TextBox label='Username' id="username" type="user" value={form.username} onChange={handleChange} />
              <TextBox label='Password' id="pass" type="password" value={form.pass} onChange={handleChange} />
              <TextBox label='Confirm Password' id="confirm" type="password" value={form.confirm} onChange={handleChange} />
              <TextBox label='Email' id="email" type="email" value={form.email} onChange={handleChange} />
              <button id="signUp" type="submit">Sign up</button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );