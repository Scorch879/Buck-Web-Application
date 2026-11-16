"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { backdropMotion, popoverMotion } from "@/utils/motion";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useIsClient } from "@/hooks/useIsClient";
import { toLocalDateString } from "@/utils/cashFlow";
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

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 6;
const NARROW_VIEWPORT_WIDTH = 480;
const FALLBACK_POPOVER_WIDTH = 280;
const FALLBACK_POPOVER_HEIGHT = 330;

type PopoverLayout =
  | { mode: "sheet" }
  | {
      mode: "anchored";
      top: number;
      left: number;
      placement: "bottom" | "top";
    };

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
  const isClient = useIsClient();
  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState<PopoverLayout>({
    mode: "anchored",
    top: VIEWPORT_MARGIN,
    left: VIEWPORT_MARGIN,
    placement: "bottom",
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);

  const [currentView, setCurrentView] = useState(() => {
    if (value) {
      const [y, m, day] = value.split("-").map(Number);
      if (y && m && day) return new Date(y, m - 1, 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  useEffect(() => {
    if (isOpen && value) {
      const [y, m, day] = value.split("-").map(Number);
      if (y && m && day) {
        setCurrentView(new Date(y, m - 1, 1));
      }
    }
  }, [isOpen, value]);

  const updateLayout = useCallback(() => {
    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof window === "undefined") return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const rect = triggerEl.getBoundingClientRect();

    const popoverEl = popoverRef.current;
    const popW =
      popoverEl?.offsetWidth ||
      Math.min(FALLBACK_POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);
    const popH = popoverEl?.offsetHeight || FALLBACK_POPOVER_HEIGHT;

    const spaceBelow = vh - rect.bottom - VIEWPORT_MARGIN - POPOVER_GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - POPOVER_GAP;
    const fitsBelow = spaceBelow >= popH;
    const fitsAbove = spaceAbove >= popH;

    let next: PopoverLayout;
    if (vw <= NARROW_VIEWPORT_WIDTH || (!fitsBelow && !fitsAbove)) {
      next = { mode: "sheet" };
    } else {
      const placement: "bottom" | "top" = fitsBelow ? "bottom" : "top";
      const rawTop =
        placement === "bottom"
          ? rect.bottom + POPOVER_GAP
          : rect.top - POPOVER_GAP - popH;
      const top = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rawTop, vh - popH - VIEWPORT_MARGIN)
      );
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, vw - popW - VIEWPORT_MARGIN)
      );
      next = { mode: "anchored", top, left, placement };
    }

    setLayout((prev) => {
      if (
        prev.mode === next.mode &&
        (prev.mode === "sheet" ||
          (next.mode === "anchored" &&
            prev.top === next.top &&
            prev.left === next.left &&
            prev.placement === next.placement))
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateLayout();
  }, [isOpen, currentView, updateLayout]);

  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => updateLayout();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, updateLayout]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, close]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentView(new Date(currentView.getFullYear(), currentView.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const currentIso = toLocalDateString(
      new Date(currentView.getFullYear(), currentView.getMonth(), day)
    );
    onChange(currentIso);
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
    const currentIso = toLocalDateString(today);
    onChange(currentIso);
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
    const todayIso = toLocalDateString(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const currentIso = toLocalDateString(new Date(year, month, i));

      const isSelected = value === currentIso;

      let isDisabled = false;
      if (min && currentIso < min) isDisabled = true;
      if (max && currentIso > max) isDisabled = true;

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

  let displayValue = "";
  if (value) {
    const [y, m, d] = value.split("-");
    if (y && m && d) {
      displayValue = `${m}/${d}/${y}`;
    }
  }

  return (
    <div className={`${styles.container} ${className}`} style={style} ref={containerRef}>
      {/* Hidden input for form submission & required validation if needed */}
      <input 
        type="text"
        value={value}
        id={id}
        name={id}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        style={{ opacity: 0, position: "absolute", bottom: 0, left: 0, width: "100%", height: "100%", zIndex: -1, pointerEvents: "none" }}
      />
      
      <div
        ref={triggerRef}
        className={`${styles.inputBox} ${isOpen ? styles.inputBoxOpen : ""} ${!value ? styles.placeholder : ""}`}
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
      >
        <span>{displayValue || placeholder}</span>
        <FaCalendarAlt className={styles.icon} aria-hidden="true" />
      </div>

      {isClient &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="datepicker-layer"
                className={
                  layout.mode === "sheet"
                    ? styles.sheetBackdrop
                    : styles.portalLayer
                }
                {...backdropMotion}
                role="presentation"
                onMouseDown={(e) => {
                  if (layout.mode === "sheet" && e.target === e.currentTarget) {
                    e.stopPropagation();
                    close();
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (layout.mode === "sheet" && e.target === e.currentTarget) {
                    close();
                  }
                }}
              >
                <motion.div
                  key="datepicker-popover"
                  ref={popoverRef}
                  {...popoverMotion}
                  className={`${styles.popover} ${
                    layout.mode === "sheet" ? styles.popoverSheet : ""
                  }`}
                  style={
                    layout.mode === "anchored"
                      ? { top: layout.top, left: layout.left }
                      : undefined
                  }
                  data-placement={
                    layout.mode === "sheet" ? "sheet" : layout.placement
                  }
                  aria-label="Calendar"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.header}>
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className={styles.navButton}
                      aria-label="Previous month"
                    >
                      <FaChevronLeft aria-hidden="true" />
                    </button>
                    <div className={styles.currentMonth}>
                      {MONTHS[month]} {year}
                    </div>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className={styles.navButton}
                      aria-label="Next month"
                    >
                      <FaChevronRight aria-hidden="true" />
                    </button>
                  </div>

                  <div className={styles.weekdays}>
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day} className={styles.weekday}>
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className={styles.daysGrid}>{renderDays()}</div>

                  <div className={styles.footer}>
                    <button
                      type="button"
                      onClick={handleClear}
                      className={styles.footerButton}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleToday}
                      className={styles.footerButtonPrimary}
                    >
                      Today
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
