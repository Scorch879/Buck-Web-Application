"use client";
import React from 'react';
import Link from 'next/link';

export default function GetStartedButton() {
  return (
    <Link href="/signup" >
      <span id="btnGetstarted" >Sign Up</span>
    </Link>
  );
}