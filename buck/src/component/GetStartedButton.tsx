"use client";
import React from 'react';
import Link from 'next/link';

export default function GetStartedButton() {
  return (
    <Link href="/sign-in" >
      <span id="btnGetstarted" >Get Started</span>
    </Link>
  );
}