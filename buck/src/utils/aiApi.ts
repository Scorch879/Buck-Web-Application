// Utility to call the backend AI API
// This function sends user data to the backend and returns the AI results

export type ExpenseInput = {
  text: string; // Description of the expense
  past_expenses: number[]; // Array of past expense amounts
  saving_attitude: 'Normal' | 'Moderate' | 'Aggressive'; // User's saving attitude
};

export type AIResponse = {
  category: string;
  base_forecast: number;
  adjusted_forecast: number;
};

// Change this URL if your backend runs elsewhere
const BACKEND_URL = 'https://buck-web-application-1.onrender.com/process_expense/';

// Add this for AI-powered saving tips
const SAVING_TIP_URL = 'https://buck-web-application-1.onrender.com/ai/saving_tip/';

export async function processExpense(input: ExpenseInput): Promise<AIResponse> {
  // Send a POST request to the backend
  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Failed to get AI response');
  }
  // Parse and return the JSON response
  return response.json();
}

export async function getSavingTip(category: string, userContext: string = "", targetDate?: string, createdAt?: string): Promise<string> {
  const body: any = { category, user_context: userContext };
  if (targetDate) body.target_date = targetDate;
  if (createdAt) body.created_at = createdAt;
  const response = await fetch(SAVING_TIP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Failed to get AI saving tip');
  }
  const data = await response.json();
  if (data.tip) return data.tip;
  throw new Error(data.error || 'Unknown error from AI');
} 