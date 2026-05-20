import {
  FaBullseye,
  FaChartLine,
  FaPiggyBank,
  FaReceipt,
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

export const savingsIcon = FaPiggyBank;
