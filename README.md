# Buck Web Application

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### 1️⃣ First, clone the repository using GitHub Desktop or Git Bash 

In using Git CMD or Git Bash, use the command below

```bash
# Git CMD or Git Bash
git clone <http link of the repository>

# Github Desktop
Press File > Clone Repository > Select Buck-Web-Application Repository
```


### For the Firebase SDK to work properly make sure to do the command below in your code

```base
#npm install for Firebase
npm install firebase
```

```bash
# then
npm install
# or
npx create-next-app@latest
```

Second, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.



```markdown
# Expense Forecasting System

## Overview
A modular system designed to track expenses and forecast spending using AI-powered components. The architecture
integrates frontend user interfaces with backend processing and specialized machine learning models.

---

## Architecture Components

### 1️⃣ Frontend (React/Next.js + Firebase Auth)
- **Purpose**: User interaction interface for expense logging, goal management, and visualization
- **Key Features**:
  - Expense input forms with real-time validation
  - Interactive UI for setting financial goals (Normal/Moderate/Aggressive profiles)
  - Data visualization dashboard showcasing spending forecasts and insights
  - Authentication system using Firebase identity services

### 2️⃣ Backend (Python FastAPI/Flask)
- **Purpose**: Core business logic processing and API gateway
- **Responsibilities**:
  ```python
  • Processes raw expense data from frontend
  • Orchestrates AI model workflows for predictions
  • Coordinates data storage across all components
  • Serves as communication bridge between frontend/UI and ML services
  ```

### 3️⃣ AI Engine (Python)
- **Powered by Three Integrated Machine Learning Models**:
  - **OpenAI Embedding API**: Auto-categorization of expenses using advanced NLP embeddings

  ```mermaid
  graph TD;
    A[Expense Text] --> B((Embedding));
    B --> C{Category Prediction};
    C --> D[Lifestyle Expenses];
    C --> E[Utilities];
    C --> F[Dining Out];
  ```

  - **XGBoost Classifier**: Predicts adjustment multipliers based on:
    ```python
      • User's historical saving patterns
      • Financial goal profiles (Normal/Moderate/Aggressive)
      • Behavioral spending signatures
    ```

  - **Facebook Prophet**:
    - Time-series forecasting of monthly spending trends
    - Adapts predictions dynamically to detect behavioral changes
    - Incorporates emergency scenario adjustments

---

## Data Flow Diagram

```markdown
## System Architecture

| Component         | Function                                       |
|-------------------|-----------------------------------------------|
| Frontend           | User interface & data display                  |
| Backend            | Core processing & API management               |
| AI Engine          | Auto-categorization, prediction & forecasting |

---

## Technologies Used

| Component | Stack Highlights |
|-----------|------------------|
| Frontend   | React, Next.js, Firebase Authentication, Tailwind CSS |
| Backend    | Python (FastAPI/Flask), PostgreSQL, Redis caching |
| AI Engine   | XGBoost, OpenAI API, Prophet time-series library |

---

## System Features

- **Auto-expense categorization** using transformer embeddings
- **Dynamic forecasting** adapting to user behavioral patterns
- **Multi-model integration** for comprehensive financial insights
- **Firebase-backed authentication** ensuring secure transactions
```
