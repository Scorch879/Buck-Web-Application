"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Header, Footer } from "@/component/HeaderFooter";
import GetStartedButton from "@/component/GetStartedButton";
import "./globals.css";

export default function Home() {
  const router = useRouter();
  const welcomeMsgRef = useRef<HTMLDivElement>(null);
  const [trailDots, setTrailDots] = useState<Array<{ id: number, x: number, y: number }>>([]);
  const nextDotId = useRef(0);

  const text = "Need help in saving your money? Guess what, go BUCK yourself! Buck can help you manage your weekly spending with a press of a button!";
  const words = text.split(" ");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05, // Stagger animation for each word
      },
    },
  };

  const wordVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { scale: 1.1, y: -5, transition: { duration: 0.2 } }, // Added hover effect
  };

  //Prefetching for optimization
  useEffect(() => {
    router.prefetch('/sign-in');
  }, [router]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (welcomeMsgRef.current) {
      const rect = welcomeMsgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newDot = {
        id: nextDotId.current++,
        x,
        y,
      };

      setTrailDots(prevDots => {
        const updatedDots = [...prevDots, newDot];
        if (updatedDots.length > 50) { // Limit number of dots to prevent performance issues
          updatedDots.shift();
        }
        return updatedDots;
      });

      // Remove dot after a short delay to create fading effect
      setTimeout(() => {
        setTrailDots(prevDots => prevDots.filter(dot => dot.id !== newDot.id));
      }, 500); // Dot visible for 500ms
    }
  };

  return (
    <>
      <Header />
      <div className="mainStrip">
        <div className="welcomeSign">
          <div className="buckmsg">
            <p id="name">Buck</p>
            <div className="smoothLine"></div>
            <p id="desc">The Budget Tracker</p>
          </div>

          <div className="buckmascot" >

          </div>
         
        </div>
        <div
          className="welcomeMsg"
          onMouseMove={handleMouseMove}
          ref={welcomeMsgRef}
        >
          <motion.p
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}
          >
            {words.map((word, index) => (
              <motion.span key={index} variants={wordVariants} style={{ marginRight: "0.25em" }}>
                {word}
              </motion.span>
            ))}
          </motion.p>
          {
            trailDots.map(dot => (
              <div
                key={dot.id}
                className="mouse-trail-dot"
                style={{
                  left: `${dot.x}px`,
                  top: `${dot.y}px`,
                }}
              />
            ))
          }
        </div>
        <GetStartedButton />
      </div>
      <Footer />
    </>
  );
}