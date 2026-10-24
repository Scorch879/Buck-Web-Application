# Carlo and Friends
Software Development 3 | Computer Engineering

# Buck
## Software Requirements Specification
### Version 1.0

---

Buck | Version: 1.0
Software Requirements Specification | Date: 08/30/2026
Software Development 3 | Computer Engineering |

# Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 08/30/2026 | 1.0 | Initial Creation | Jobert Gamboa |

---

Buck | Version: 1.0
Software Requirements Specification | Date: 08/30/2026
Software Development 3 | Computer Engineering |

# Table of Contents

1. Introduction
   1.1 Purpose
   1.2 Scope
   1.3 Definitions, Acronyms, and Abbreviations
   1.4 Overview
2. Overall Description
3. Specific Requirements
   3.4 Functionality
       3.4.1 Expense & Income Management (with Mobile Receipt OCR)
       3.4.2 Budget Forecasting & AI Financial Advisory
       3.4.3 Multi-Wallet & Financial Accounts Management
       3.4.4 Financial Goals & Savings Tracker
       3.4.5 Analytics, Statistics & Data Visualizations
       3.4.6 User Profile, Authentication & Account Lifecycle
   3.5 Usability
       3.5.1 Usability 1: Cross-Platform Accessibility
       3.5.2 Usability 2: Simple and Clean UI
   3.6 Reliability & Availability
       3.6.1 Reliability 1: Real-Time AI Processing
       3.6.2 Availability 1: Cloud-Based Hosting
   3.7 Performance
   3.8 Security
       3.8.1 Security 1: User Authentication
       3.8.2 Security 2: Data Privacy
   3.9 Design Constraints
   3.10 Interfaces
       3.10.1 Interface 1: Frontend Interface (React Web + Flutter Mobile)
       3.10.2 Interface 2: Backend API Interface (FastAPI + Supabase)

---

Buck | Version: 1.0
Software Requirements Specification | Date: 08/30/2026
Software Development 3 | Computer Engineering |

# Software Requirements Specification

## 1. Introduction

Buck: Finance & Expenses Tracker is an intelligent, cross-platform personal finance management system engineered to help individuals gain complete control and visibility over their personal cash flow. By merging automated receipt scanning, zero-shot AI expense categorization, multi-wallet tracking, goal-oriented savings, and predictive time-series forecasting, the project addresses the widespread challenges of tedious manual financial logging and insufficient budgeting literacy.

### 1.1 Purpose

The primary purpose of Buck: Finance & Expenses Tracker is to empower users with an effortless, intelligent, and proactive tool to monitor, manage, and optimize their daily finances. The project aims to eliminate the friction of manual bookkeeping by utilizing mobile camera OCR to digitize receipts and AI models to automatically categorize transactions. Furthermore, Buck provides personalized financial advice and time-series spending forecasts in Philippine Peso (PHP), enabling users across diverse backgrounds—such as students, young professionals, educators, and seniors—to cultivate sustainable saving habits, avoid budget deficits, and achieve long-term financial goals.

### 1.2 Scope

The operational scope of Buck: Finance & Expenses Tracker encompasses a synchronized cross-platform ecosystem designed specifically for individual consumers—including students, educators, salary-earning professionals, freelancers, and elderly individuals—seeking a streamlined yet intelligent tool to monitor and manage their income and expenses. Enterprise multi-tenant (B2B) billing and corporate accounting systems are strictly excluded from the project.

The system functions across two synchronized platforms: a Next.js (React) Web Application and a Flutter Mobile Application, backed by a Supabase PostgreSQL cloud backend and a Python FastAPI machine learning microservice. Buck delivers comprehensive personal financial tools by enabling users to manage multiple wallets, log income and expenses, scan physical receipts via mobile camera OCR, leverage Together AI (LLaMA 3.3) for automated categorization across 17 standard categories, track dedicated savings goals, and receive Facebook Prophet budget forecasts and personalized saving advice in Philippine Peso (PHP).

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Description |
| :--- | :--- |
| AI | Artificial Intelligence (AI), Optical Character Recognition (OCR), Large Language Models (LLM), Supabase PostgreSQL, Row Level Security (RLS), Next.js, and Flutter SDK |

### 1.4 Overview

The system specification is organized to provide a complete understanding of Buck's capabilities and technical foundations. Section 2 describes the user characteristics, operating environments, constraints, and high-level system architecture. Section 3 details the functional subsystems, process workflows, usability standards, reliability benchmarks, performance requirements, security controls, and external system interfaces.

## 2. Overall Description

Buck: Finance & Expenses Tracker directly addresses the pervasive challenges faced by individuals—including students, teachers, employees, and seniors—in managing their personal finances, especially within the constraints of rising living costs, irregular allowances, and limited financial literacy. Many individuals struggle due to a lack of accessible financial tools and insufficient budgeting literacy, which ultimately impacts their financial stability and well-being. The proposed system, Buck, resolves these issues by providing a smart, cross-platform solution for tracking, analyzing, and forecasting personal cash flow.

The proposed system leverages AI to automate expense categorization into 17 standard categories, scan physical receipts via mobile OCR, predict monthly spending behavior using Facebook Prophet, and tailor saving strategies based on the user's selected financial attitude (Normal, Moderate, Aggressive). The solution is designed to support synchronized Web (Next.js) and Mobile (Flutter) platforms, ensuring accessibility and convenience for all users.

This SRS also outlines the key stakeholders involved—primarily individual users, academic evaluators, and developers maintaining the project for Software Development 3. The document captures their needs and expectations, as gathered from user research and prototyping activities.

The major features of the Buck system include:
- Intelligent categorization of expenses via AI.
- Spending forecast adjusted to the user's saving attitude (Normal, Moderate, Aggressive).
- Emergency spending adjustment capabilities.
- Visualizations such as graphs and pie charts.
- Custom alerts for exceeding budgets.

Each feature is supported by a robust cross-platform system architecture composed of a Next.js (React) web frontend, a Flutter mobile client with native camera OCR, a Python FastAPI microservice, and a Supabase PostgreSQL backend secured by Row Level Security.

The following SRS document further details the functional and non-functional requirements from the perspective of various users. It highlights the expected behavior, user characteristics, system constraints, and key functions of Buck, making it a well-rounded financial assistant tailored specifically to individual personal finance needs.

## 3. Specific Requirements

The specific requirements are –

### 3.4 Functionality
- **Expense & Income Management (with Mobile Receipt OCR)**
- **Budget Forecasting & AI Financial Advisory**
- **Multi-Wallet & Financial Accounts Management**
- **Financial Goals & Savings Tracker**
- **Analytics, Statistics & Data Visualizations**
- **User Profile, Authentication & Account Lifecycle**

#### 3.4.1 Expense & Income Management Subsystem (Cross-Platform & Mobile OCR)
Allows users to record, categorize, scan, verify, filter, and audit their daily cash transactions across both web and mobile environments.

**Sub-Module 1: Cross-Platform Transaction Logging**
Enables manual recording of financial transactions on both Next.js Web and Flutter Mobile applications:
- Users input transaction amount in Philippine Peso (PHP), select transaction type (Expense or Income), choose an active source wallet, and select the transaction date via an interactive calendar picker.
- Optional fields include payee/vendor name, custom descriptive notes, and spending tags.
- Upon submission, the transaction is validated for numerical precision (maximum 2 decimal places) and atomically saved to the Supabase PostgreSQL database under the user's isolated account.

**Sub-Module 2: Mobile-Exclusive Optical Character Recognition (OCR) Receipt Scanning**
The Flutter mobile client provides an advanced, on-device optical receipt scanner that eliminates manual typing by extracting transaction metadata directly from paper receipts:
- Optical Capture & Viewfinder: Launches native camera hardware with a real-time viewfinder overlay featuring document edge guides, auto-focus, and flash toggles. Captures high-resolution images, optimized for text legibility.
- Image Preprocessing & Adaptive Binarization: Executes on-device pre-processing algorithms, including grayscale conversion, contrast optimization, perspective deskewing, and adaptive Gaussian thresholding. These enhancements ensure resilient text detection even on crumpled paper, uneven lighting, shadows, or faded thermal register print.
- On-Device Text Recognition Engine: Utilizes Google ML Kit Text Recognition on the mobile device to perform optical character recognition locally. Detects bounding boxes, text blocks, and line coordinates in real time without network latency or external cloud transmission.
- Heuristic Entity Extraction Pipeline:
  - Merchant/Vendor Identification: Analyzes top-level bounding boxes and matches detected strings against a curated dictionary of commercial establishments and retail vendors.
  - Date Parsing: Employs multi-format regular expressions supporting Philippine standard formats.
  - Currency & Net Total Extraction: Detects currency indicators ('PHP', 'Php', '₱', 'P') and isolates numerical values. Evaluates vertical spatial relationships and keywords to correctly isolate the final payable amount, differentiating it from subtotal, 12% EVAT, and service charges.
- Human-in-the-Loop Verification Modal: Displays the captured receipt image alongside auto-populated editable form fields (Vendor, Date, Amount, Wallet Selector, and Category). Users can verify accuracy, adjust misread characters, and assign a wallet before finalizing the entry into the financial ledger.
- Quality Detection & Resilient Fallback: If blurriness, extreme glare, or unreadable text is detected, the system immediately notifies the user with diagnostic advice (e.g., 'Image too blurry or poorly lit—please retake or proceed with manual logging') ensuring zero user frustration or lost entries.

**Sub-Module 3: Zero-Shot AI Expense Categorization**
Transactions entered without manual categorization are automatically analyzed and classified by an intelligent zero-shot classifier:
- Text descriptions are routed through the Python FastAPI microservice to Together AI (LLaMA 3.3 70B Turbo).
- The model evaluates semantic context and assigns the transaction to one of 17 standard categories:
  [1] Food & Dining [2] Groceries [3] Transportation [4] Utilities
  [5] Housing & Rent [6] Healthcare/Medical [7] Education [8] Entertainment
  [9] Shopping [10] Personal Care [11] Debt & Loans [12] Investments
  [13] Gifts & Charity [14] Travel & Vacation [15] Subscriptions [16] Emergency
  [17] Miscellaneous
- Provides confidence scores and allows users to manually reassign categories with a single tap, continuously aligning with personal spending semantics.

**Sub-Module 4: Emergency Expense Flagging & Baseline Isolation**
Users can designate unexpected crisis transactions (e.g., urgent hospital fees, emergency vehicle repairs, plumbing fixes) as an 'Emergency':
- Emergency transactions are highlighted with visual warning tags across ledgers and dashboard feeds.
- Flagged entries are programmatically isolated from recurring monthly spending baselines, preventing non-recurring spending anomalies from artificially inflating regular budget forecasts.

**Sub-Module 5: Transaction Filtering, Search & Ledger History**
Provides comprehensive audit and exploration capabilities across financial histories:
- Multi-parameter filtering allows users to isolate transactions by date range, specific wallet, category, minimum/maximum amount, and emergency flag status.
- Implements full-text search across descriptions and merchant names.
- Features server-side pagination and infinite scroll for optimal performance across large historical ledgers.
- Allows one-tap export of filtered transaction histories into standard CSV formats for personal accounting.

**User-Side Operational Flows & Functions for Expense Management:**
- User Flow 1: Manual Expense Recording & Categorization
  - Step 1: User navigates to the Expense Logging screen on Web or Mobile and selects 'Add Transaction'.
  - Step 2: User toggles 'Expense' (default) or 'Income', inputs the numerical amount in Philippine Peso (PHP), and selects the corresponding source wallet (e.g., Cash, GCash, Maya).
  - Step 3: User enters a descriptive text (e.g., 'Jollibee lunch with teammates') and picks the transaction date.
  - Step 4: If user leaves the category unselected, the frontend asynchronously dispatches the description to the Together AI (LLaMA 3.3) endpoint via FastAPI, which infers and suggests the optimal category (e.g., 'Food & Dining') with confidence indicators.
  - Step 5: User reviews the auto-assigned category, makes any manual adjustments if desired, and clicks 'Save Transaction'.
  - Step 6: The system deducts the amount from the selected wallet in an atomic database operation, updates the aggregated net worth, records the transaction in the ledger, and triggers background cache revalidation on the client.

- User Flow 2: Mobile Optical Character Recognition (OCR) Receipt Scanning
  - Step 1: User opens the Flutter mobile application and taps the floating Camera Action Button.
  - Step 2: The viewfinder overlay appears with green boundary framing guides, auto-focusing on the paper receipt. User aligns the receipt and taps 'Capture' (or toggles flash if in low-light conditions).
  - Step 3: On-device ML Kit extracts text blocks, normalizes coordinates, applies perspective correction, and parses the vendor name, date, and final payable amount (PHP).
  - Step 4: The system displays a 'Verify Scanned Receipt' interactive modal sheet showing the cropped receipt thumbnail alongside pre-filled input fields (Merchant Name, Date, Net Total Amount, Target Wallet, and Inferred AI Category).
  - Step 5: User verifies extracted values, overrides any misread values (e.g., adjusting an ambiguous handwritten digit or changing payment wallet from Cash to GCash), and taps 'Confirm & Save'.
  - Step 6: The transaction is saved directly to the user's ledger, wallet balance updates instantly, and the cropped receipt image is cached locally with optional private cloud backup.

- User Flow 3: Emergency Expense Flagging & Isolation Flow
  - Step 1: When logging an unexpected urgent expense (e.g., hospital bill, urgent car repair), user toggles the 'Emergency' switch.
  - Step 2: The UI prompts the user to select the urgency category and optionally link a dedicated emergency savings vault or source wallet.
  - Step 3: Upon saving, the transaction is marked with a distinctive red emergency badge in the ledger.
  - Step 4: The system automatically routes the transaction to the emergency balance register and programmatically excludes it from the Prophet baseline spending forecast, ensuring baseline monthly projections remain unskewed by non-recurring crises.

#### 3.4.2 Budget Forecasting & AI Financial Advisory Subsystem
Provides predictive financial intelligence, dynamic trend-based attitude adaptation, and personalized generative financial coaching that continuously learns from user behavior over time.

**Sub-Module 1: Baseline Saving Attitude Profiles & Initial Multipliers**
Users configure an initial saving attitude that anchors the financial guidance model:
- Normal Profile (1.00x Multiplier): Standard balanced baseline aligned with historical average monthly expenditure.
- Moderate Profile (1.15x Multiplier): Conservative threshold that tightens discretionary limits and encourages a 15% buffer.
- Aggressive Profile (1.30x Multiplier): Rigorous savings mode that enforces strict spending ceilings to maximize liquid capital accumulation.

**Sub-Module 2: Time-Series Expenditure Forecasting (Facebook Prophet)**
The FastAPI microservice executes Facebook Prophet additive regression models on the user's historical transaction timeseries:
- Evaluates non-linear daily spending patterns, weekend surges, and bi-monthly salary cyclicalities.
- Projects the estimated cumulative end-of-month expenditure alongside upper and lower confidence intervals.
- Dynamically estimates the expected end-of-month cash surplus or deficit based on projected spending and active monthly income.

**Sub-Module 3: Trend-Based Adaptive Learning Engine (Dynamic Multiplier Recalibration)**
The Financial Advisor does not rely on static rules; it continuously learns from the user's longitudinal logging patterns and spending momentum:
- Behavioral Habit Tracking: Monitors rolling 14-day, 30-day, and 60-day moving averages across the 17 categories. Tracks discretionary volatility (spending spikes in Entertainment, Dining, and Shopping), weekend surge ratios, and post-payday acceleration.
- Trend-Based Dynamic Multiplier Adaptation:
  - Positive Trend Adaptation: When a user consistently spends below the nominal attitude limit over consecutive periods, the engine detects enhanced financial discipline, adjusts the effective multiplier downward, and recalculates the budget forecast to project higher surplus, recommending allocations to active goals.
  - Overspending Trend Adaptation: When a user repeatedly exceeds discretionary category allowances, the advisor identifies the behavioral shift, dynamically raises the effective forecasting curve, and recalibrates the Prophet model to realistically reflect actual trajectory rather than an idealized baseline.
  - Seasonal & Anomaly Awareness: Recognizes recurring monthly deadlines (rent, utilities) and isolates non-recurring emergency transactions to avoid false behavioral penalization.
- Closed-Loop Model Recalibration: The Prophet timeseries models automatically refit weekly or upon substantial transaction volume shifts, incorporating newly established velocity patterns directly into the forecast equations.

**Sub-Module 4: Generative AI Financial Advisor Tips (Personalized Guidance in PHP)**
The system synthesizes the user's historical trend metrics, attitude compliance score, and month-to-date velocity into dynamic advice:
- Utilizes Together AI (LLaMA 3.3 70B Turbo) via prompt engineering to generate concise, two-sentence actionable tips strictly denominated in Philippine Peso (PHP).
- Evolutionary Guidance: Advice evolves from basic onboarding suggestions into hyper-personalized, context-rich insights as user history accumulates (e.g., highlighting specific category drivers such as 'You have spent ₱1,850 on Food & Dining in the last 4 days, which is 35% higher than your Moderate attitude trend. Trimming dining out by ₱300/day over the next week will keep your ₱5,000 savings goal on track.').
- Positive Habit Reinforcement: Acknowledges disciplined spending streaks with positive reinforcement, motivating sustained adherence.

**Sub-Module 5: Overspending Threshold Alerts & Visual Gauges**
Continuously evaluates current spending against attitude-adjusted allocations:
- Renders visual progress gauges displaying percentage of allocated budget consumed.
- Automatically triggers warning banners and notifications when monthly spending crosses 80% (Caution) and 100% (Critical Overspending) thresholds.

**User-Side Operational Flows & Functions for Budget Forecasting & Financial Advisory:**
- User Flow 4: Trend-Based Budget Forecasting & Scenario Exploration
  - Step 1: User navigates to the 'Statistics & Forecast' view on Web or Mobile.
  - Step 2: The system renders an interactive Prophet forecast line graph displaying historical actual expenditures, current month-to-date velocity, and projected end-of-month cumulative spending with shaded confidence intervals.
  - Step 3: User views the projected month-end balance (e.g., 'Projected Surplus: ₱7,450.00' or 'Projected Deficit: ₱1,200.00').
  - Step 4: User can interactively switch attitude profiles (Normal, Moderate, Aggressive) to explore how different levels of fiscal discipline immediately impact projected surpluses and goal completion timelines.
  - Step 5: The UI displays the user's 'Attitude Adherence Score' and recent trend indicators (e.g., 'Trending 8% under budget over the last 14 days').

- User Flow 5: Daily User Interaction with the Adaptive AI Financial Advisor
  - Step 1: Upon opening the Dashboard, the user is presented with the 'AI Advisor Tip' banner positioned prominently above the wallet overview.
  - Step 2: The advisor displays a fresh 2-sentence actionable recommendation reflecting the latest transaction trends and active goal milestones.
  - Step 3: If an anomaly or overspending trend is detected, an interactive action pill appears (e.g., 'Inspect Dining Spike' or 'Adjust Goal Timeline'), allowing the user to navigate directly to the root cause.
  - Step 4: User reviews the insight, applies the behavioral recommendation, and observes real-time adjustments in their projected month-end surplus.

#### 3.4.3 Multi-Wallet & Financial Accounts Management Subsystem
Provides comprehensive multi-account oversight, balance consolidation, and atomic fund reallocation.

**Sub-Module 1: Wallet Creation & Account Customization**
Enables users to configure multiple liquid asset repositories representing distinct real-world financial accounts:
- Supports predefined account types: Physical Cash, Mobile E-Wallets (GCash, Maya), Bank Checking/Savings Accounts, and Dedicated Vaults.
- Users assign custom wallet labels, distinct color badges, and initial balances in Philippine Peso (PHP).

**Sub-Module 2: Aggregated Real-Time Net Worth Calculation**
Continuously aggregates account balances across all active wallets:
- Automatically recalculates net worth whenever an income, expense, or transfer transaction occurs.
- Displays consolidated liquid net worth on the primary dashboard with 2-decimal precision.

**Sub-Module 3: Atomic Inter-Wallet Transfers**
Enables fund reallocations between two owned wallets (e.g., transferring funds from Bank Savings to GCash or Cash):
- Requires selection of source wallet, destination wallet, transfer amount (PHP), and optional transfer notes.
- Executes within an atomic database transaction that simultaneously debits the source and credits the destination.
- Transfers are designated as neutral movements and are strictly excluded from gross income and gross expense calculations.

**Sub-Module 4: Wallet Archival & Reconciliation**
Users can archive inactive or depleted wallets without losing associated transaction histories:
- Provides balance reconciliation tools allowing users to correct discrepancies between recorded app balances and physical cash counts, logging adjustment entries for audit transparency.

#### 3.4.4 Financial Goals & Savings Tracker Subsystem
Empowers users to define, visualize, and systematically fulfill specific savings objectives.

**Sub-Module 1: Goal Creation & Milestone Setting**
Users create customized target savings goals by defining a title, target amount in Philippine Peso (PHP), target completion date, and priority level:
- Configures progressive milestone checkpoints at 25%, 50%, 75%, and 100% completion.

**Sub-Module 2: Real-Time Goal Progress Visualizer**
Displays active goals on interactive card widgets:
- Renders dynamic progress bars displaying percentage completed, current accumulated savings, and remaining funds required.
- Dynamically calculates the required daily and monthly savings rate necessary to fulfill the target amount by the chosen deadline.

**Sub-Module 3: AI-Assisted Target Feasibility Projections**
The system evaluates the user's goal feasibility against historical financial velocity:
- Compares the required monthly contribution against the user's average net monthly cash surplus calculated by the Prophet forecast model.
- Automatically displays feasibility indicators (e.g., 'On Track', 'Pacing Needed', or 'Target Unfeasible at Current Spending Rate') and suggests realistic target date adjustments.

**Sub-Module 4: Goal Vault Allocation & Release**
Allows users to deposit funds from active wallets into dedicated goal vaults:
- Deposited funds can be set aside from daily available spending balances.
- Upon reaching 100% completion, the system prompts the user to celebrate milestone achievement and release funds back into a chosen active wallet.

#### 3.4.5 Analytics, Statistics & Data Visualization Subsystem
Translates financial data into actionable, visual intelligence across customizable timeframes.

**Sub-Module 1: Category Expenditure Distribution (Interactive Donut Charts)**
Renders interactive SVG/Canvas donut charts illustrating proportional spending across the 17 standard categories:
- Displays percentage contributions, numerical monetary values, and allows drilling down into individual category transaction logs.

**Sub-Module 2: Monthly Inflow vs. Outflow Comparative Analysis (Grouped Bar Charts)**
Visualizes historical monthly comparisons of total gross income versus total gross expenses:
- Renders grouped bar charts across 6-month and 12-month spans, visually displaying net savings rates and seasonal variations.

**Sub-Module 3: Cash Flow & Cumulative Net Worth Trajectory (Line Graphs)**
Plots continuous daily balance trends over 30-day, 90-day, and 1-year historical horizons:
- Provides an intuitive visual indicator of capital growth trajectory and cash stability over time.

**Sub-Module 4: Emergency vs. Discretionary Spending Ratio**
Computes and illustrates the proportion of non-discretionary essential/emergency spending versus discretionary lifestyle spending, providing an objective health metric of financial discipline and emergency resilience.

#### 3.4.6 User Profile, Authentication & Account Lifecycle Subsystem
Maintains user identity, access controls, cryptographic session security, and account compliance.

**Sub-Module 1: Secure Onboarding & Cross-Device Authentication**
Handles user registration, authentication, and session persistence across web and mobile platforms:
- Powered by Supabase Authentication with secure email/password credential validation and password reset flows.
- Enforces Server-Side Rendering (SSR) cookie-based authentication with HMAC verification on the Next.js web application.
- Utilizes secure platform keychain storage (Android Keystore and iOS Keychain) for encrypted JWT token persistence on the Flutter mobile application.
- Enforces automatic session expiration following prolonged user inactivity to prevent unauthorized access.

**Sub-Module 2: Profile Preferences & Baseline Configuration**
Allows users to personalize account metadata:
- Configures monthly income baselines, notification preferences, default payment wallet, and active saving attitude multipliers.

**Sub-Module 3: 10-Day Account Deletion & Recovery Grace Period**
Provides a GDPR-compliant soft-deletion and recovery lifecycle:
- Upon requesting account deletion, the system places the profile into a 10-day soft-deleted state, restricting active access while preserving data.
- Generates a secure recovery token sent to the user's verified email, allowing one-click account restoration within the 10-day window.
- After 10 days elapse, an automated background worker executes a permanent cascade deletion of all user records, wallets, transactions, goals, and credentials.

**Sub-Module 4: System Health Telemetry & Administrative Oversight**
Provides system administrators with real-time operational telemetry:
- Monitors database connection pool health, query latency, Supabase storage utilization, and external AI API response times.
- Maintains tamper-evident audit logs of authentication failures, automated purge events, and rate-limit violations.

### 3.5 Usability

#### 3.5.1 Usability 1: Web Accessibility
Buck is designed with a responsive web dashboard for desktop and mobile browsers, alongside a native Flutter mobile app, allowing users to track finances seamlessly across devices.

#### 3.5.2 Usability 2: Simple and Clean UI
The interface is intuitive, with minimal steps to log expenses, view forecasts, and modify settings. Icons and color-coded charts enhance understanding.

### 3.6 Reliability & Availability

#### 3.6.1 Reliability 1: Real-Time AI Processing
Expense categorization and forecasts are processed quickly and reliably due to modular backend architecture. If external AI APIs experience downtime, the system gracefully falls back to manual categorization.

#### 3.6.2 Availability 1: Cloud-Based Hosting
Hosted on Supabase cloud PostgreSQL infrastructure with automated backups and web APIs, ensuring 99.9% uptime, data consistency, and high scalability.

### 3.7 Performance
The system can handle multiple concurrent users and rapidly process financial entries. AI categorization returns within 2000 milliseconds, mobile receipt OCR scanning executes in under 3000 milliseconds, and interactive charts update in real time on the frontend.

### 3.8 Security

#### 3.8.1 Security 1: User Authentication
Uses Supabase Authentication combined with strict PostgreSQL Row Level Security (RLS) policies enforcing auth.uid() = user_id, ensuring users can strictly access only their own financial records.

#### 3.8.2 Security 2: Data Privacy
All financial data is stored securely and only accessible to the respective user. No bank account credentials or live banking APIs are integrated. Prompts dispatched to external AI models are strictly sanitized of all Personally Identifiable Information (PII).

### 3.9 Design Constraints
Due to privacy and complexity concerns, Buck does not support real-time bank linking. All data must be entered manually.
Camera receipt scanning is strictly exclusive to the Flutter mobile application due to native device camera hardware dependencies.
The system currently only supports transactions and calculations in Philippine Peso (PHP / ₱) with 2 decimal precision, with no multi-currency conversion.

### 3.10 Interfaces
Buck interacts through both frontend and backend interfaces. Key interfaces include:

#### 3.10.1 Interface 1: Frontend Interface (React Web + Flutter Mobile)
Allows users to log in, log transactions, scan receipts (Mobile), view categorized forecasts and AI advisor tips, manage multiple wallets, and track savings goals.

#### 3.10.2 Interface 2: Backend API Interface (FastAPI + Supabase)
Connects the frontend applications to Supabase PostgreSQL for persistent data storage and to the Python FastAPI microservice for Together AI zero-shot classification and Facebook Prophet time-series forecasting.
