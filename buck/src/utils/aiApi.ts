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
const BACKEND_URL = 'http://localhost:8000/process_expense/';

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