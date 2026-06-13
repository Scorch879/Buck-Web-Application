# Wallet Search & Filters

This document outlines the new search and filter capabilities added to the Wallets dashboard.

## Overview
To improve navigation when managing multiple wallets, we have introduced dedicated search bars and filter/sort dropdowns to both the **Your Wallets** (active) and **History of Wallets** sections.

## 1. Your Wallets (Active Wallets)
The primary section for managing active wallets now includes interactive sorting and searching.

- **Expanding Search Bar:** 
  - To save horizontal screen space (especially on mobile), the search input is hidden behind a `FaSearch` icon by default.
  - Clicking the icon expands the search bar smoothly using a CSS `transition: width 0.3s`.
  - Clicking the icon again while expanded clears the search query and collapses the bar.
  - Searching performs a case-insensitive match against the wallet's name.

- **Sort Dropdown:**
  - Placed alongside the search icon and the "New Wallet" button.
  - Allows users to order their active wallets by:
    - **Highest Budget** (descending)
    - **Lowest Budget** (ascending)
    - **A-Z** (alphabetical by name)
    - **Newest - Oldest** (most recently created first)
    - **Oldest - Newest** (oldest created first)

## 2. History of Wallets (Log)
The history section contains both active and archived (deleted) wallets, so its controls are tailored for auditing.

- **Permanent Search Bar:**
  - Unlike the active section, this search bar is permanently visible (`max-width: 240px`).
  - Allows quick case-insensitive filtering by wallet name.

- **Filter Dropdown:**
  - Allows users to filter the historical log by status:
    - **All:** Shows every wallet ever created.
    - **Active Only:** Hides any wallet that has a `deletedAt` timestamp.
    - **Archived Only:** Shows ONLY wallets that have been deleted (have a `deletedAt` timestamp).

## CSS & Responsiveness
All new UI components use flexbox (`.wallet-controls-container`) with `flex-wrap: wrap` to ensure they stack cleanly on narrow mobile screens while maintaining a polished inline row layout on desktop. Components heavily rely on the existing design tokens (`var(--buck-surface)`, `var(--buck-orange)`) to perfectly match the Buck aesthetic.

- **Spacing & Alignment:** Increased the container gap to `0.85rem` to ensure the search icon, dropdown, and action buttons have comfortable breathing room. On desktop/tablet, added `flex: 1` and `justify-content: flex-end` so controls neatly anchor to the top-right. On mobile views (`< 521px`), assigned `width: 100%` to the controls container, forcing it to drop cleanly below the card title rather than awkwardly squishing beside it.
- **Dropdown Readability:** Added `2rem` right padding to `.wallet-filter-select` to ensure the native dropdown arrow doesn't awkwardly overlap with long text like "Highest Budget".
