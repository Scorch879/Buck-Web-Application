# Buck-Web-Application

##🏗️ System Architecture
Architectural Design
The system follows a modular architecture, separating concerns between the frontend, backend, and AI engine:

🚀 Frontend (React/Next.js + Firebase Auth)
Handles user interaction, expense input, goal setting (Normal / Moderate / Aggressive), and forecast display.

⚙️ Backend (Python FastAPI/Flask)
Processes data, runs AI models, and returns categorized expenses and forecasted spending.

🧠 AI Engine (Python)
Three integrated models:

OpenAI Embedding API — for auto-categorizing expenses.

XGBoost Classifier — predicts the adjustment multiplier based on the user's saving attitude.

Facebook Prophet — forecasts spending trends and adjusts based on user behavior and emergencies.

graph LR
  A[Frontend (React/Next.js + Firebase Auth)] --> B[Backend API (Python FastAPI/Flask)]
  B --> C[AI Engine (Python)]
  C -->|OpenAI Embedding API| C
  C -->|XGBoost Classifier| C
  C -->|Facebook Prophet| C
  B -->|Firebase (User data storage)| D[Firebase]

🔍 Key Modules
Frontend
Built with React and Next.js, uses Firebase Authentication for user login and session management.

Backend
Python-based API (FastAPI or Flask) to handle data processing, user requests, and communication with the AI engine.

AI Engine

OpenAI Embedding API for expense categorization.

XGBoost for predicting savings attitude.

Facebook Prophet for forecasting and emergency adjustments.
