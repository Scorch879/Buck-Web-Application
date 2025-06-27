"use client";
import React from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const Statistics = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sticky Header */}
      <DashboardHeader initialActiveNav="statistics" />
      <div
        className="dashboard-container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Line Graph */}
        <div
          style={{
            width: 500,
            marginBottom: "2rem",
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
            border: "1.5px solid #ffd6b0",
            padding: "2rem 1.5rem",
          }}
        >
          <Line
            data={{
              labels: [
                "Mon",
                "Tue",
                "Wed",
                "Thu",
                "Fri",
                "Sat",
                "Sun",
              ],
              datasets: [
                {
                  label: "Progress",
                  data: [2, -3, 7, 4, 6, -1, 2],
                  borderColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, "#2ecc40");
                    gradient.addColorStop(1, "#ff4136");
                    return gradient;
                  },
                  backgroundColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
                    if (!chartArea) return;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0.5, "rgba(46,204,64,0.3)");
                    gradient.addColorStop(0.5, "rgba(255,65,54,0.3)");
                    return gradient;
                  },
                  fill: true,
                  tension: 0.4,
                  pointBackgroundColor: "#2ecc40",
                  pointBorderColor: "#2ecc40",
                  pointRadius: 5,
                  pointHoverRadius: 7,
                  borderWidth: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
              },
              scales: {
                x: {
                  grid: { display: false },
                },
                y: {
                  grid: { color: "#888" },
                  beginAtZero: true,
                },
              },
            }}
          />
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
            border: "1.5px solid #ffd6b0",
            padding: "3rem 2rem",
            maxWidth: 500,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "#2c3e50",
              marginBottom: "2rem",
            }}
          >
            What the Buck?!
            <br />
            You dont have any goals yet.
            <br />
            Would you like to create one?
          </h2>
          <button
            className="nav-button"
            style={{
              fontSize: "1.1rem",
              padding: "0.8rem 2.5rem",
              marginTop: "1.5rem",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            onClick={() => router.push("/dashboard/goals/create")}
          >
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
