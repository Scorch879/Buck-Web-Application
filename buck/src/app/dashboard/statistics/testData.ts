

// Centralized test data for dashboard statistics
export const statisticsTestData = {
  categories: [
    "Food",
    "Fare",
    "Gas Money",
    "Video Games",
    "Shopping",
    "Bills",
    "Other",
  ],
  maxBudgetPerDay: 1000,
  categoryTotals: [200, 100, 500, 200, 1000, 300, 500],
  //categoryTotals: [220, 60, 40, 90, 70, 110, 30],
  weeklyCategorySpending: [
    [200, 100, 500, 200, 1000, 300, 500], // Week 1
    [30, 8, 7, 15, 12, 25, 3], // Week 2
    [35, 12, 6, 18, 8, 20, 4], // Week 3
    [45, 15, 8, 22, 15, 35, 7], // Week 4
  ],
  get weeklyTotals() {
    return this.weeklyCategorySpending.map((week: number[]) =>
      week.reduce((a: number, b: number) => a + b, 0)
    );
  },
  barColors: [
    "#ff4136", // Food - red
    "#2ecc40", // Fare - green
    "#0074d9", // Gas Money - blue
    "#b10dc9", // Video Games - purple
    "#ffb347", // Shopping - orange
    "#ef8a57", // Bills - coral
    "#ffd700", // Other - gold
  ],
  get totalSpending() {
    return this.categoryTotals.reduce((a: number, b: number) => a + b, 0);
  },
  totalSavings: 150, // Example static value
  get excessSpending() {
    return this.totalSpending - this.totalSavings;
  },
};

export const testCategories = statisticsTestData.categories;
export const testAmounts = statisticsTestData.weeklyCategorySpending[0];
export const barColors = statisticsTestData.barColors;
