"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import styles from "./CustomDatePicker.module.css";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CustomDatePicker({
  value,
  onChange,
  placeholder = "Select date",
  required = false,
  min,
  max,
  className = "",
  style,
  id,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // currentView determines which month/year is being displayed in the popover
  const [currentView, setCurrentView] = useState(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    if (isOpen && value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setCurrentView(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  }, [isOpen, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(currentView.getFullYear(), currentView.getMonth(), day);
    // Adjust for timezone offset to safely format as YYYY-MM-DD
    const tzOffset = selected.getTimezoneOffset() * 60000;
    const localIso = new Date(selected.getTime() - tzOffset).toISOString().slice(0, 10);
    onChange(localIso);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  const handleToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localIso = new Date(today.getTime() - tzOffset).toISOString().slice(0, 10);
    onChange(localIso);
    setCurrentView(new Date(today.getFullYear(), today.getMonth(), 1));
    setIsOpen(false);
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const year = currentView.getFullYear();
  const month = currentView.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const renderDays = () => {
    const days = [];
    
    // Empty slots for days before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = new Date(year, month, i).toLocaleDateString("en-CA"); // YYYY-MM-DD locally if en-CA, but safer to construct string manually
      
      const pad = (n: number) => n.toString().padStart(2, "0");
      const currentIso = `${year}-${pad(month + 1)}-${pad(i)}`;
      
      const isSelected = value === currentIso;
      
      // Check min/max bounds
      let isDisabled = false;
      if (min && currentIso < min) isDisabled = true;
      if (max && currentIso > max) isDisabled = true;

      const todayIso = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const isToday = currentIso === todayIso;

      days.push(
        <button
          key={i}
          type="button"
          disabled={isDisabled}
          className={`${styles.dayButton} ${isSelected ? styles.selectedDay : ""} ${isToday && !isSelected ? styles.todayDay : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleDateSelect(i);
          }}
        >
          {i}
        </button>
      );
    }
    
    return days;
  };

  // Format display value safely
  let displayValue = "";
  if (value) {
    const [y, m, d] = value.split("-");
    if (y && m && d) {
      displayValue = `${m}/${d}/${y}`; // mm/dd/yyyy format
    }
  }

  return (
    <div className={`${styles.container} ${className}`} style={style} ref={containerRef}>
      {/* Hidden input for form submission & required validation if needed */}
      <input 
        type="text"
        value={value}
        id={id}
        required={required}
        readOnly
        style={{ opacity: 0, position: "absolute", zIndex: -1, width: 0, height: 0 }}
      />
      
      <div 
        className={`${styles.inputBox} ${isOpen ? styles.inputBoxOpen : ""} ${!value ? styles.placeholder : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span>{displayValue || placeholder}</span>
        <FaCalendarAlt className={styles.icon} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={styles.popover}
          >
            <div className={styles.header}>
              <button type="button" onClick={handlePrevMonth} className={styles.navButton}>
                <FaChevronLeft />
              </button>
              <div className={styles.currentMonth}>
                {MONTHS[month]} {year}
              </div>
              <button type="button" onClick={handleNextMonth} className={styles.navButton}>
                <FaChevronRight />
              </button>
            </div>
            
            <div className={styles.weekdays}>
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className={styles.weekday}>{day}</div>
              ))}
            </div>

            <div className={styles.daysGrid}>
              {renderDays()}
            </div>
            
            <div className={styles.footer}>
              <button type="button" onClick={handleClear} className={styles.footerButton}>Clear</button>
              <button type="button" onClick={handleToday} className={styles.footerButtonPrimary}>Today</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
