import { formatCurrency } from "@/utils/formatters";
import type { GoalPlan, PeriodAmounts, SavingAttitude } from "@/utils/goalAttitude";

const PERIODS: readonly { key: keyof PeriodAmounts; label: string; note?: string }[] = [
  { key: "perDay", label: "Per day" },
  { key: "perWeek", label: "Per week" },
  // The plan counts a month as 30 days; the note sits on its own line so the
  // row label stays narrow on a phone.
  { key: "perMonth", label: "Per month", note: "30 days" },
];

/** The attitude the AI Advisor detected, with where it came from. */
export function AttitudeChip({
  attitude,
  source = "Detected by your AI Advisor",
}: {
  attitude: SavingAttitude;
  source?: string;
}) {
  return (
    <span className="goal-attitude-chip">
      <span className={`goals-pill goals-pill--attitude goals-pill--${attitude.toLowerCase()}`}>
        {attitude}
      </span>
      <span className="goal-attitude-source">{source}</span>
    </span>
  );
}

/**
 * Daily, weekly and monthly amounts for a goal's plan (ADR-055). The numbers
 * come from Buck_AI; this only lays them out. `showRequired` adds the saving
 * the goal needs to land exactly on its target date.
 */
export default function GoalPlanTable({
  plan,
  caption,
  showRequired = false,
}: {
  plan: GoalPlan;
  caption: string;
  showRequired?: boolean;
}) {
  return (
    <table className="goal-plan">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <td />
          <th scope="col">Spend up to</th>
          <th scope="col">Save</th>
          {showRequired && <th scope="col">Needed for your date</th>}
        </tr>
      </thead>
      <tbody>
        {PERIODS.map(({ key, label, note }) => (
          <tr key={key}>
            <th scope="row">
              {label}
              {note && <span className="goal-plan-note">{note}</span>}
            </th>
            <td>{formatCurrency(plan.spending[key])}</td>
            <td>{formatCurrency(plan.saving[key])}</td>
            {showRequired && <td>{formatCurrency(plan.required[key])}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
