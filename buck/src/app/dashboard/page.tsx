"use client";
import { useState } from "react";
import React from "react";
import "./style.css";
import Image from "next/image";

export const Dashboard = (): React.JSX.Element => {
  return (
    <div className="dashboard" data-model-id="94:4481">
      <div className="overlap-wrapper">
        <div className="overlap">
          <div className="inner-rect" />

          <div className="outer-rect" />

          <div className="tabs" />

          <div className="duck-image">
            <div className="overlap-group">
              <div className="ellipse" />

              <Image
                className="duck-rect-shape"
                alt="Duck rect shape"
                src="/BuckMascot.png"
                width={24}
                height={24}
              />
            </div>
          </div>

          <div className="spending-att-pie">
            <div className="orange-rect">
              <div className="circle-contents">
                <div className="div">
                  <div className="circle-inner" />

                  <div className="text-wrapper">att</div>
                </div>
              </div>

              <div className="text-wrapper-2">summary text right here</div>
            </div>
          </div>

          <div className="summary-of-shits" />

          <div className="summary-graph">
            <div className="weekly-summary">
              <div className="graph">
                <div className="y-axis">
                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>

                  <div className="text-wrapper-3">0</div>
                </div>

                <div className="bar-graph-frame">
                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Sunday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Monday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Tuesday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Wednesday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Thursday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Friday</div>
                  </div>

                  <div className="div-2">
                    <div className="div-3" />

                    <div className="text-wrapper-5">Saturday</div>
                  </div>
                </div>
              </div>

              <div className="header">Weekly Summary of Expenses</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;