"use client";
import React from 'react';

export default function GetStartedButton() {

  const handleGetStarted = () => {
    alert("Get Started clicked!");
  };

  return (
    <button id="btnGetstarted" onClick={handleGetStarted}>
      <span>Get Started</span>
    </button>
  );
}