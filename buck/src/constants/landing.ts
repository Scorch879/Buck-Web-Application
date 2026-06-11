import {
  FaBell,
  FaBullseye,
  FaCalendarWeek,
  FaChartLine,
  FaDatabase,
  FaLock,
  FaPiggyBank,
  FaReceipt,
  FaShieldAlt,
  FaWallet,
} from "react-icons/fa";

export const landingNavItems = [
  { label: "Home", targetId: "home" },
  { label: "Features", targetId: "features" },
  { label: "About", targetId: "about" },
];

export const landingStats = [
  { value: "7-day", label: "weekly spending view" },
  { value: "AI", label: "saving suggestions" },
  { value: "Goals", label: "progress tracking" },
];

export const landingFeatures = [
  {
    title: "Goal Tracking",
    description:
      "Create clear saving goals, track progress, and keep your next milestone visible.",
    image: "/goaltracking.svg",
    icon: FaBullseye,
  },
  {
    title: "Expense Tracking",
    description:
      "Log daily expenses, organize them by category, and see where your money is going.",
    image: "/expensetracking.svg",
    icon: FaReceipt,
  },
  {
    title: "Forecasting",
    description:
      "Use forecast insights to understand what you can spend while still protecting your goal.",
    image: "/forecasting.svg",
    icon: FaChartLine,
  },
];

export const landingSteps = [
  "Set your wallet budget.",
  "Create a saving goal.",
  "Track expenses and adjust with AI insights.",
];

export const landingPrinciples = [
  {
    title: "Simple by default",
    description:
      "Buck keeps the most important numbers easy to scan, then lets you dig deeper when you need to.",
  },
  {
    title: "Built for habits",
    description:
      "Weekly views, recent expenses, and progress cards help budgeting feel like a rhythm instead of a chore.",
  },
  {
    title: "Friendly guidance",
    description:
      "AI tips support your goals without taking control away from you.",
  },
];

export const landingHighlights = [
  {
    title: "Know the week",
    description: "See what you spent from Monday to Sunday.",
  },
  {
    title: "Protect the goal",
    description: "Keep your target amount in sight before spending.",
  },
  {
    title: "Adjust faster",
    description: "Use category and forecast views to course-correct early.",
  },
];

export const landingBudgetRhythm = [
  {
    title: "Plan the week",
    description: "Set a wallet limit before the week starts feeling noisy.",
    icon: FaCalendarWeek,
  },
  {
    title: "Log quickly",
    description: "Add expenses by category so the numbers stay current.",
    icon: FaReceipt,
  },
  {
    title: "Catch drift",
    description: "See when one category starts pulling the whole budget off pace.",
    icon: FaBell,
  },
  {
    title: "Move money wisely",
    description: "Know when it is safe to protect a goal or slow spending down.",
    icon: FaWallet,
  },
];

export const landingSecurityNotes = [
  {
    title: "Protected sign in",
    description:
      "Supabase Auth handles account sessions while Buck keeps protected pages behind verified checks.",
    icon: FaLock,
  },
  {
    title: "Private budget space",
    description:
      "Wallets, expenses, and goals are designed to stay tied to the signed-in user.",
    icon: FaDatabase,
  },
  {
    title: "Session safety",
    description:
      "Idle sessions can be timed out so a shared device does not stay open forever.",
    icon: FaShieldAlt,
  },
];

export const savingsIcon = FaPiggyBank;
