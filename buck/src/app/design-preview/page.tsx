import Link from "next/link";
import { FaArrowRight, FaEye } from "react-icons/fa";
import "./style.css";

const previewRoutes = [
  {
    href: "/",
    title: "Landing Page",
    description: "Homepage, hero, feature cards, adviser card, and footer.",
  },
  {
    href: "/sign-in",
    title: "Sign In",
    description: "Modern Buck authentication page.",
  },
  {
    href: "/create-account",
    title: "Create Account",
    description: "Signup flow and account creation form.",
  },
  {
    href: "/forgot-password",
    title: "Forgot Password",
    description: "Password reset request and recovery screen.",
  },
  {
    href: "/check-email?email=preview@buck.local",
    title: "Check Email",
    description: "Account-created confirmation page.",
  },
  {
    href: "/dashboard/home",
    title: "Dashboard Home",
    description: "Weekly spending summary and category cards.",
  },
  {
    href: "/dashboard/statistics",
    title: "Statistics",
    description: "Charts, category management, and expense list.",
  },
  {
    href: "/dashboard/goals",
    title: "Goals",
    description: "Goal cards, progress, forecast, and recent expenses.",
  },
];

export default function DesignPreviewPage() {
  const previewEnabled =
    process.env.NEXT_PUBLIC_DESIGN_PREVIEW_MODE === "true";

  return (
    <main className="DP-Page">
      <section className="DP-Hero">
        <div className="DP-Kicker">
          <FaEye aria-hidden="true" />
          Design Preview
        </div>
        <h1>Review Buck screens one page at a time.</h1>
        <p>
          Use these links while checking layouts, responsive behavior, and
          visual polish. Dashboard preview uses sample data when preview mode is
          enabled.
        </p>
        <div
          className={`DP-Status ${
            previewEnabled ? "DP-Status--enabled" : "DP-Status--disabled"
          }`}
        >
          {previewEnabled
            ? "Preview mode is enabled."
            : "Preview mode is off. Dashboard pages still require login."}
        </div>
      </section>

      <section className="DP-Grid" aria-label="Preview routes">
        {previewRoutes.map((route) => (
          <Link href={route.href} className="DP-Card" key={route.href}>
            <span>
              <strong>{route.title}</strong>
              <small>{route.description}</small>
            </span>
            <FaArrowRight aria-hidden="true" />
          </Link>
        ))}
      </section>
    </main>
  );
}
