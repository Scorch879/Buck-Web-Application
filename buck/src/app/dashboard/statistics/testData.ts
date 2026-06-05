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
  maxBudgetPerDay: 0,
  //categoryTotals: [200, 100, 500, 200, 1000, 300, 500],
  categoryTotals: [220, 60, 40, 90, 70, 110, 30],
  weeklyCategorySpending: [
    [0, 0, 0, 0, 0, 0, 0], // Week 1
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
    "#ff3838", // Food - coral
    "#f47536", // Fare - Buck orange
    "#ffc547", // Gas Money - Buck gold
    "#ff8d3d", // Video Games - warm orange
    "#b83324", // Shopping - deep coral
    "#ffb85c", // Bills - amber
    "#fff0c8", // Other - soft gold
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
