"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CustomSelect from "@/component/CustomSelect";
import { suggestCategory } from "@/utils/aiApi";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import {
  addCategory,
  addExpenseWithWalletDeduction,
  deleteCategory,
  updateCategoryName,
  type BuckCategory,
} from "@/utils/supabaseData";

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  categories: BuckCategory[];
  /** Goal the expense is linked to, if any. */
  goalId?: string | null;
  /** Called after an expense is saved (wallet balance changed). */
  onSaved: () => void;
}

/** Add-expense dialog with inline category management (Statistics tab). */
export default function AddExpenseModal({
  open,
  onClose,
  userId,
  categories,
  goalId,
  onSaved,
}: AddExpenseModalProps) {
  const { toast } = useToast();
  const isDarkTheme = useAuthPageTheme();
  const primaryButtonBackground = isDarkTheme
    ? "linear-gradient(135deg, #ffc547, #f47536)"
    : "linear-gradient(135deg, #f47536, #ff3838)";
  const primaryButtonColor = isDarkTheme ? "#241409" : "#fffaf4";
  const softBackground = isDarkTheme
    ? "rgba(255,197,71,0.10)"
    : "rgba(255,240,200,0.52)";
  const fieldBackground = isDarkTheme
    ? "rgba(255,197,71,0.08)"
    : "rgba(255,250,244,0.74)";

  const [expenseDate, setExpenseDate] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");

  const handleEditCategory = async (catId: string, newName: string) => {
    if (!newName.trim()) return;
    await updateCategoryName(userId, catId, newName);
    setEditingCategoryId(null);
    setEditCategoryName("");
  };

  // Category awaiting the three-step delete confirmation (ADR-041).
  const [pendingCategory, setPendingCategory] = useState<BuckCategory | null>(null);

  const handleRemoveCategory = async (catId: string) => {
    try {
      await deleteCategory(userId, catId);
      toast("Category deleted successfully", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete category", "error");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    await addCategory(userId, newCategory);
    setNewCategory("");
    setAddingCategory(false);
  };

  const handleAddExpense = async () => {
    if (!expenseDate || !expenseAmount || !expenseDesc) {
      setExpenseError("Date, amount and description are required.");
      return;
    }
    setExpenseLoading(true);
    setExpenseError("");
    try {
      // No category picked: the AI Advisor suggests one of the user's own.
      const aiCategory = selectedCategory ? null : await suggestCategory("expense", expenseDesc);
      await addExpenseWithWalletDeduction(userId, {
        date: expenseDate,
        amount: parseFloat(expenseAmount),
        description: expenseDesc,
        categoryName: selectedCategory || aiCategory || "Uncategorized",
        goalId: goalId ?? null,
      });
      onSaved();
      onClose();
      setExpenseDate("");
      setExpenseAmount("");
      setExpenseDesc("");
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExpenseLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.4)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <motion.div
            className="modal"
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              background: "var(--buck-surface)",
              borderRadius: 20,
              padding: 32,
              width: "min(540px, 100%)",
              maxHeight: "min(82dvh, 760px)",
              overflowY: "auto",
              boxSizing: "border-box",
              boxShadow: "0 12px 48px rgba(239,138,87,0.18)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              color: "var(--buck-ink)",
              fontSize: 17,
            }}
          >
            <button
              onClick={() => onClose()}
              style={{
              position: "absolute",
              top: 18,
              right: 22,
              background: "none",
              border: "none",
              fontSize: 26,
              cursor: "pointer",
              color: "var(--buck-orange)",
              fontWeight: 700,
              transition: "color 0.2s",
            }}
          >
            &times;
          </button>
          <h3
            style={{
              marginTop: 0,
              marginBottom: 18,
              color: "var(--buck-orange)",
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: 1,
            }}
          >
            Add Expense
          </h3>
          <CustomDatePicker
            value={expenseDate}
            onChange={(val) => setExpenseDate(val)}
            style={{
              width: "100%",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />
          <input
            type="number"
            value={expenseAmount}
            onChange={(e) => setExpenseAmount(e.target.value)}
            placeholder="Amount"
            style={{
              width: "100%",
              marginBottom: 12,
              padding: 12,
              borderRadius: 7,
              border: "1px solid rgba(244,117,54,0.32)",
              fontSize: 17,
              boxSizing: "border-box",
              display: "block",
              color: "var(--buck-ink)",
              background: fieldBackground,
              transition: "border 0.2s",
            }}
          />
          <input
            type="text"
            value={expenseDesc}
            onChange={(e) => setExpenseDesc(e.target.value)}
            placeholder="Description"
            style={{
              width: "100%",
              marginBottom: 12,
              padding: 12,
              borderRadius: 7,
              border: "1px solid rgba(244,117,54,0.32)",
              fontSize: 17,
              boxSizing: "border-box",
              display: "block",
              color: "var(--buck-ink)",
              background: fieldBackground,
              transition: "border 0.2s",
            }}
          />
          {/* Category Search Bar (moved above Manage Categories) */}
          <div style={{ width: "100%", margin: "0 0 10px 0" }}>
            <input
              type="text"
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              placeholder="Search categories..."
              style={{
                width: "100%",
                marginBottom: 8,
                padding: 10,
                borderRadius: 6,
                border: "1px solid rgba(244,117,54,0.38)",
                fontSize: 16,
                color: "var(--buck-ink)",
                background: softBackground,
                boxSizing: "border-box",
                display: "block",
                transition: "border 0.2s",
              }}
            />
            <div
              style={{
                fontWeight: 600,
                color: "var(--buck-orange)",
                marginBottom: 4,
                fontSize: 16,
              }}
            >
              Manage Categories:
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 120,
                overflowY: "auto",
                marginBottom: 8,
              }}
            >
              {categories
                .filter((cat) =>
                  cat.name
                    .toLowerCase()
                    .includes(categorySearch.toLowerCase())
                )
                .map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {editingCategoryId === cat.id ? (
                      <>
                        <input
                          value={editCategoryName}
                          onChange={(e) =>
                            setEditCategoryName(e.target.value)
                          }
                          style={{
                            flex: 1,
                            padding: 7,
                            borderRadius: 5,
                            border: "1px solid rgba(244,117,54,0.32)",
                            fontSize: 16,
                            color: "var(--buck-ink)",
                            background: fieldBackground,
                          }}
                        />
                        <button
                          onClick={() =>
                            handleEditCategory(cat.id, editCategoryName)
                          }
                          style={{
                            background: primaryButtonBackground,
                            color: primaryButtonColor,
                            border: "none",
                            borderRadius: 5,
                            padding: "0.3rem 0.8rem",
                            fontWeight: 700,
                            fontSize: 15,
                            marginLeft: 4,
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditCategoryName("");
                          }}
                          style={{
                            background: "none",
                            color: "var(--buck-orange)",
                            border: "none",
                            fontWeight: 700,
                            fontSize: 15,
                            marginLeft: 2,
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1 }}>{cat.name}</span>
                        <button
                          onClick={() => {
                            setEditingCategoryId(cat.id);
                            setEditCategoryName(cat.name);
                          }}
                          style={{
                            background: "none",
                            color: "var(--buck-orange)",
                            border: "none",
                            fontWeight: 700,
                            fontSize: 15,
                            marginLeft: 2,
                            cursor: "pointer",
                            transition: "color 0.2s",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setPendingCategory(cat)}
                          style={{
                            background: "none",
                            color: "var(--buck-coral)",
                            border: "none",
                            fontWeight: 700,
                            fontSize: 15,
                            marginLeft: 2,
                            cursor: "pointer",
                            transition: "color 0.2s",
                          }}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                ))}
            </div>
          </div>
          <div style={{ marginBottom: 12, width: "100%" }}>
            <label
              style={{
                fontWeight: 700,
                color: "var(--buck-orange)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Category:
            </label>
            <CustomSelect
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val)}
              options={[
                { value: "", label: "Select category" },
                ...categories
                  .filter((cat) =>
                    cat.name
                      .toLowerCase()
                      .includes(categorySearch.toLowerCase())
                  )
                  .map((cat) => ({ value: cat.name, label: cat.name })),
              ]}
            />
            <button
              onClick={() => setAddingCategory(true)}
              style={{
                marginTop: 10,
                background: "none",
                color: "var(--buck-orange)",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 16,
                transition: "color 0.2s",
              }}
            >
              + Add Category
            </button>
          </div>
          {addingCategory && (
            <div
              style={{
                marginBottom: 14,
                width: "100%",
                animation: "fadeIn 0.2s",
              }}
            >
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category name"
                style={{
                  width: "100%",
                  padding: 10,
                  borderRadius: 6,
                  border: "1px solid rgba(244,117,54,0.32)",
                  fontSize: 16,
                  color: "var(--buck-ink)",
                  background: fieldBackground,
                  boxSizing: "border-box",
                  display: "block",
                  transition: "border 0.2s",
                }}
              />
              <button
                onClick={handleAddCategory}
                style={{
                  marginTop: 10,
                  background: primaryButtonBackground,
                  color: primaryButtonColor,
                  border: "none",
                  borderRadius: 6,
                  padding: "0.6rem 1.3rem",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                Add
              </button>
            </div>
          )}
          {expenseError && (
            <div style={{ color: "red", marginBottom: 12 }}>
              {expenseError}
            </div>
          )}
          <button
            onClick={handleAddExpense}
            disabled={expenseLoading}
            style={{
              background: primaryButtonBackground,
              color: primaryButtonColor,
              border: "none",
              borderRadius: 9,
              padding: "1.1rem 1.7rem",
              fontWeight: 800,
              fontSize: 20,
              cursor: "pointer",
              width: "100%",
              marginTop: 10,
              boxShadow: "0 2px 8px rgba(239,138,87,0.08)",
              transition: "background 0.2s",
            }}
          >
            {expenseLoading ? "Adding..." : "Add Expense"}
          </button>
        </motion.div>
      </motion.div>
    )}
      <DangerDeleteDialog
        key="delete-category"
        open={Boolean(pendingCategory)}
        itemType="category"
        itemName={pendingCategory?.name ?? ""}
        consequences={["Existing expenses keep their category name but lose the link to this category."]}
        onCancel={() => setPendingCategory(null)}
        onConfirm={async () => {
          if (!pendingCategory) return;
          await handleRemoveCategory(pendingCategory.id);
          setPendingCategory(null);
        }}
      />
    </AnimatePresence>
  );
}
