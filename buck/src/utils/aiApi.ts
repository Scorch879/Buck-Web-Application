import { aiBackendFetch } from "@/utils/aiBackend";

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

// Host comes from NEXT_PUBLIC_AI_BACKEND_URL (see aiBackend.ts). Calls are authenticated.
const BACKEND_PATH = '/process_expense/';
const SAVING_TIP_PATH = '/ai/saving_tip/';

export async function processExpense(input: ExpenseInput): Promise<AIResponse> {
  // Send a POST request to the backend
  const response = await aiBackendFetch(BACKEND_PATH, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Failed to get AI response');
  }
  // Parse and return the JSON response
  return response.json();
}

export async function getSavingTip(category: string, userContext: string = "", targetDate?: string, createdAt?: string): Promise<string> {
  const body: Record<string, string> = { category, user_context: userContext };
  if (targetDate) body.target_date = targetDate;
  if (createdAt) body.created_at = createdAt;
  const response = await aiBackendFetch(SAVING_TIP_PATH, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Failed to get AI saving tip');
  }
  const data = await response.json();
  if (data.tip) return data.tip;
  throw new Error(data.error || 'Unknown error from AI');
} 