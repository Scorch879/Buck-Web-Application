# Carlo and Friends
Software Development 3 | Computer Engineering

---

# Buck
## Software Requirements Specification
### Version 1.0

---

# Revision History

| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 08/30/2026 | 1.0 | Initial draft and system architecture definition | Jobert Gamboa |
| 09/04/2026 | 1.1 | Detailed module specification, cross-platform requirements, and AI alignment | Jobert Gamboa |

---

# Table of Contents

1. Introduction  
   1.1 Purpose  
   1.2 Scope  
   1.3 Definitions, Acronyms, and Abbreviations  
   1.4 References  
   1.5 Overview  
2. Overall Description  
3. Specific Requirements  
   3.1 Functionality  
       3.1.1 Cross-Platform Expense and Income Management  
       3.1.2 Mobile-Exclusive Optical Character Recognition (OCR) Receipt Scanning  
       3.1.3 Automated AI Expense Categorization  
       3.1.4 Multi-Wallet and Financial Accounts Management  
       3.1.5 Budget Tracking and Limit Alerts  
       3.1.6 AI Spending Forecasting and Trend Analysis  
       3.1.7 AI Financial Advisor and Saving Recommendations  
       3.1.8 Financial Goals and Target Savings  
       3.1.9 Analytics, Statistics, and Visual Reports  
       3.1.10 User Profile, Authentication, and Account Lifecycle  
   3.2 Usability  
       3.2.1 Graphical User Interface  
       3.2.2 Accessibility  
   3.3 Reliability & Availability  
       3.3.1 Back-end Cloud Infrastructure  
       3.3.2 Service and Network Availability  
   3.4 Performance  
   3.5 Security  
       3.5.1 Data Transfer  
       3.5.2 Data Storage  
   3.6 Design Constraints  
       3.6.1 Standard Development Tools  
       3.6.2 Web and Mobile Based Product  
   3.7 Interfaces  
       3.7.1 User Interfaces  
       3.7.2 Hardware Interfaces  
       3.7.3 Software Interfaces  
       3.7.4 Communications Interfaces  

---

# Software Requirements Specification

# 1. Introduction

The introduction of the Software Requirements Specification (SRS) provides an overview of the entire SRS with purpose, scope, definitions, acronyms, abbreviations, references, and overview of the SRS. The aim of this document is to gather, analyze, and provide an in-depth insight into the complete Buck: Finance & Expenses Tracker software system by defining the problem statement in detail. Furthermore, it concentrates on the capabilities required by stakeholders and their needs while defining high-level product features. The detailed requirements of the Buck personal finance platform are provided in this document.

## 1.1 Purpose

The purpose of the document is to collect and analyze all assorted ideas that have come up to define the system and its requirements with respect to consumers. Also, it predicts and details how this product will be used in order to gain a comprehensive understanding of the project, outline concepts that may be developed, and document features that have been refined as the product evolves.

In short, the purpose of this SRS document is to provide a detailed overview of our software product, its parameters, and its goals. This document describes the project's target audience, user interfaces, hardware requirements, and software requirements. It defines how our client, team, and audience see the product and its functionality. Nonetheless, it helps any designer, software engineer, and QA engineer to assist in software delivery lifecycle (SDLC) processes.

## 1.2 Scope

Primarily, the scope pertains to the Buck product features for delivering an intelligent personal finance and expense tracking ecosystem across Web and Mobile platforms. It focuses on the target consumers, the stakeholders, and the applications that allow for streamlined cash flow monitoring, multi-wallet oversight, automated receipt scanning, intelligent expense classification, and predictive spending forecasting.

This SRS is also aimed at specifying requirements of software to be developed, and it can also be applied to assist in the selection of in-house and cloud architectural components. The standard is used to create software requirements specifications directly and serves as a model for project standards. It encompasses a Next.js Web Application and a Flutter Mobile Application backed by a Supabase PostgreSQL database and a Python FastAPI machine learning microservice. Enterprise multi-tenant (B2B) corporate billing systems are strictly excluded.

## 1.3 Definitions, Acronyms, and Abbreviations

| Term | Description |
| :--- | :--- |
| AI | Artificial Intelligence (Edge Machine Learning and Cloud AI services) |
| OCR | Optical Character Recognition (On-device mobile camera receipt text extraction engine) |
| LLM | Large Language Model (Natural Language Processing zero-shot classification and financial advisory engine) |
| Time-Series Model | Additive Regression Forecasting Model (Predictive monthly spending analytics engine) |
| RLS | Row Level Security (PostgreSQL kernel-level access control enforcing strict user data isolation) |
| PHP | Philippine Peso (Official system currency standard: ₱) |
| SSR | Server-Side Rendering (Next.js web application architecture with server-side authentication validation) |
| JWT | JSON Web Token (Cryptographically signed token for mobile and web session management) |
| EVAT | Electronic Value Added Tax (12% standard sales tax parsed from Philippine retail receipts) |
| PII | Personally Identifiable Information (Sanitized from all AI inference payloads) |

## 1.4 References

The references are:  
- Buck Software Architecture & Design Model  
- Buck Database Schema & Migration Specification  
- Buck Security & RLS Compliance Guide  
- Vision & Requirements Specification Draft 1  

## 1.5 Overview

The remaining sections of this document provide a general description, including characteristics of the users of this project, the product's hardware environment, and the functional and data requirements of the product. The general description of the project is discussed in section 2 of this document. Section 3 gives the functional requirements, data requirements, constraints, and assumptions made while designing the Buck system. It also gives the user viewpoint of the product, detailed description of functional requirements, and external interface requirements. Section 4 provides supporting information.

# 2. Overall Description

This document contains the problem statement that the target users face, particularly the challenges of personal cash flow management under irregular allowances, rising costs of living, tedious manual bookkeeping, and limited budgeting literacy. It further contains a list of stakeholders and users of the proposed solution—including students, educators, salary-earning professionals, freelancers, and seniors. It also illustrates the needs and expectations of the stakeholders identified during requirements analysis. It lists and describes the major features and core architecture of the proposed system.

The following SRS contains the detailed product perspective from different stakeholders. It provides the detailed product functions of Buck with user characteristics, permitted constraints, assumptions, and dependencies. The system delivers a synchronized cross-platform experience across Web (Next.js) and Mobile (Flutter), offering atomic wallet deductions, mobile-exclusive optical receipt scanning, zero-shot expense categorization across 17 standard categories, budget threshold alerts, additive time-series forecasting, and adaptive attitude-based financial advice in Philippine Peso.

# 3. Specific Requirements

The specific requirements are –

## 3.1 Functionality

Introduction –  
This subsection contains the functional requirements for Buck: Finance & Expenses Tracker. These requirements are organized by the core features of the personal finance system, mapping directly to user workflows across web and mobile platforms. All these functional requirements can be traced using the system traceability matrix.

### 3.1.1 Cross-Platform Expense and Income Management

The system shall allow user to record expense and income transactions with amount, category, date, and source wallet.

The system shall enforce numeric precision of up to two decimal places (numeric(14, 2)) in Philippine Peso (PHP).

The system shall atomically deduct the expense amount from the selected wallet balance upon submission.

The system shall automatically refund the full transaction amount to the originating wallet upon deletion.

The system shall calculate the differential amount and adjust the wallet balance when an expense is updated.

The system shall support soft deletion of wallets, preserving historical transaction integrity.

The system shall provide searchable and filterable transaction history by date range, wallet, and category.

### 3.1.2 Mobile-Exclusive Optical Character Recognition (OCR) Receipt Scanning

The system shall provide mobile receipt scanning exclusive to the mobile application via native camera hardware.

The system shall capture high-resolution receipt images through a dedicated camera viewfinder with guide overlays.

The system shall perform on-device image preprocessing including grayscale conversion, contrast enhancement, and adaptive Gaussian binarization.

The system shall extract receipt text using on-device machine learning edge vision recognition models without network latency.

The system shall parse merchant name, transaction date, and net payable amount in Philippine Peso.

The system shall isolate the net total payable from subtotal amounts, service fees, and 12% EVAT.

The system shall present an editable human-in-the-loop verification modal allowing the user to review and correct parsed receipt data before saving.

The system shall notify the user and offer manual fallback if receipt image quality, glare, or lighting is insufficient.

### 3.1.3 Automated AI Expense Categorization

The system shall automatically classify transactions into 17 standard expense categories using zero-shot NLP language models.

The 17 standard categories shall include: Food, Fare, Gas Money, Video Games, Shopping, Bills, Education, Electronics, Entertainment, Health, Home, Insurance, Social, Sport, Tax, Telephone, and Transportation.

The system shall map expense notes and merchant names to appropriate categories without requiring user manual selection.

The system shall support user manual override of the AI-suggested category.

### 3.1.4 Multi-Wallet and Financial Accounts Management

The system shall allow user to create and manage multiple liquid wallets (e.g., Cash, Bank, E-Wallet).

The system shall display aggregated total net worth across all active wallets in real time.

The system shall support atomic inter-wallet fund transfers with atomic source debit and target credit.

The system shall provide wallet balance reconciliation and audit history.

The system shall archive inactive wallets via soft deletion without affecting historical transaction records.

### 3.1.5 Budget Tracking and Limit Alerts

The system shall allow user to set monthly spending budgets per category and per wallet.

The system shall calculate real-time budget consumption percentages.

The system shall display visual progress indicators and gauges for current budget consumption.

The system shall alert the user when spending reaches the 80% caution threshold.

The system shall alert the user when spending reaches or exceeds the 100% critical budget limit.

### 3.1.6 AI Spending Forecasting and Trend Analysis

The system shall forecast future monthly expenditures using additive time-series regression models.

The system shall calculate 80% upper and lower statistical confidence bounds for projected expenses.

The system shall compute estimated end-of-month financial surplus or deficit.

The system shall exclude emergency or anomalous one-off expenses from standard baseline forecasts.

### 3.1.7 AI Financial Advisor and Saving Recommendations

The system shall generate personalized, actionable saving advice limited to exactly two sentences.

The system shall recommend specific numeric budget adjustments in Philippine Peso (PHP).

The system shall tailor recommendations according to user-selected saving attitudes: Normal (1.0x), Moderate (0.80x/1.15x), and Aggressive (0.60x/1.30x).

The system shall dynamically adjust advice based on 14-day, 30-day, and 60-day moving average spending velocity.

### 3.1.8 Financial Goals and Target Savings

The system shall allow user to create dedicated financial goals with target amounts and target completion dates.

The system shall allow user to allocate funds from wallets toward specific goals.

The system shall track percentage completion progress and remaining days for each goal.

The system shall celebrate goal completion and adjust wallet balances accordingly.

### 3.1.9 Analytics, Statistics, and Visual Reports

The system shall display interactive visual charts including spending trends, daily expense bars, and category breakdown pie charts.

The system shall provide monthly and yearly cash flow comparison reports.

The system shall display top spending categories and historical expenditure velocity.

### 3.1.10 User Profile, Authentication, and Account Lifecycle

The system shall allow user to register an account and authenticate credentials securely.

The system shall enforce session expiration after 30 minutes of user inactivity.

The system shall synchronize session activity across browser tabs using cross-tab communication.

The system shall provide secure password reset via single-use cryptographic verification tokens.

The system shall support account deletion with a 10-day recovery grace period prior to permanent data purge.

## 3.2 Usability

### 3.2.1 Graphical User Interface

The system shall provide a uniform look and feel across all web pages and mobile application screens.

The system shall provide a responsive user interface adapting seamlessly to mobile, tablet, and desktop viewports.

The system shall provide clear financial icons, progress gauges, and visual feedback for user actions.

### 3.2.2 Accessibility

The system shall provide high-contrast text and elements adhering to WCAG 2.1 accessibility standards.

The system shall support dark and light theme options for visual comfort and readability.

The system shall support screen readers and keyboard navigation across all web interfaces.

## 3.3 Reliability & Availability

### 3.3.1 Back-end Cloud Infrastructure

The system shall store all databases on managed cloud infrastructure with automatic failover and multi-region replication.

The system shall provide automated daily database backups with point-in-time recovery capabilities.

The system shall utilize redundant database clusters to prevent single points of failure.

### 3.3.2 Service and Network Availability

The system shall maintain 99.9% service uptime across web hosting and API server environments.

The system shall gracefully handle intermittent mobile network disconnection with local offline caching and queue synchronization.

## 3.4 Performance

The product shall be based on web and mobile platforms and run efficiently on standard cloud server infrastructure.

The product shall achieve an initial page load time under 2.0 seconds on standard broadband and 4G/5G mobile networks.

The mobile OCR receipt scanning engine shall complete image text extraction in under 1.5 seconds on device.

The AI forecasting and advisory inference endpoints shall complete execution within 3.0 seconds under normal load.

The performance shall depend upon hardware components and internet connection strength of the client device.

## 3.5 Security

### 3.5.1 Data Transfer

The system shall enforce HTTPS / TLS 1.3 encryption on all communications containing user and financial data.

The system shall automatically log out all users after a 30-minute period of inactivity.

The system shall validate all requests with cryptographically signed session cookies or JWT bearer tokens.

The system shall not leave any cookies on the client's computer containing the user's plaintext password.

The system shall sanitize financial data payloads before sending to AI models, ensuring zero Personally Identifiable Information is transmitted.

### 3.5.2 Data Storage

The customer's web browser and mobile app shall never display user passwords in plain text.

The system shall enforce PostgreSQL Row Level Security (RLS) ensuring users can only read and write their own records.

The system's back-end databases shall be encrypted at rest using AES-256 standard encryption.

The system shall hash all user passwords using salted cryptographic algorithms (bcrypt) before storage.

The mobile application shall store sensitive authentication tokens in hardware-backed secure storage (Android Keystore / iOS Keychain).

The system's back-end database and administrative services shall only be accessible to authenticated administrators.

## 3.6 Design Constraints

### 3.6.1 Standard Development Tools

The system web application shall be built using Next.js (React) conforming to modern responsive web application standards.

The system mobile application shall be built using Flutter for cross-platform Android and iOS operation.

The backend microservices shall be developed using Python FastAPI for machine learning inference and Supabase PostgreSQL for relational data storage.

### 3.6.2 Web and Mobile Based Product

The web application shall be compatible with modern web browsers such as Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge.

The mobile application shall support mobile operating systems Android 8.0+ and iOS 13.0+.

The receipt scanning feature shall require physical camera hardware on the mobile device.

The product shall be stored and hosted in such a way that allows the client seamless 24/7 access.

A general knowledge of basic smartphone and computer skills is required to use the product.

## 3.7 Interfaces

There are many types of interfaces supported by the Buck software system namely: User Interface, Software Interface, Hardware Interface, and Communications Interface.

The protocol used shall be HTTPS and WSS (WebSockets).

The Port number used will be 443.

There shall be logical address of the system in IPv4 and IPv6 format.

### 3.7.1 User Interfaces

The user interface for the software shall be compatible with any standard modern web browser and mobile operating system.

The user interface shall provide responsive navigation bars, dashboard summaries, transaction cards, modal dialogues, and visual charts.

### 3.7.2 Hardware Interfaces

The mobile application shall interface with native device camera hardware for optical receipt scanning.

All hardware devices running the software shall require an active internet connection (Wi-Fi, Mobile LTE/5G, or Ethernet).

### 3.7.3 Software Interfaces

1. The system shall communicate with the PostgreSQL cloud database engine for atomic financial transaction storage and Row Level Security enforcement.  
2. The system shall communicate with the machine learning forecasting microservice for additive time-series spending trend analysis.  
3. The system shall communicate with the Natural Language Processing (NLP) model service for zero-shot transaction categorization and 2-sentence saving tips.  
4. The mobile application shall communicate with on-device machine learning edge vision libraries for optical character recognition text extraction.  
5. The system shall communicate with cloud authentication identity providers for user authentication and session token issuance.  
6. The system shall communicate with transactional email service providers for password resets, email verification, and account recovery notices.  

### 3.7.4 Communications Interfaces

The system shall use the HTTPS protocol for communication over the internet and secure WebSockets (WSS) for real-time state synchronization.

Internal communication between backend microservices shall be through secure TCP/IP protocol suites.
