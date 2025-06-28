import React, { useEffect, useState } from "react";
import { db, auth } from "@/utils/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import styles from "./WalletModal.module.css";
import { motion } from "framer-motion";

interface Wallet {
  id: string;
  name: string;
  budget: number;
}

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [addBtnMouse, setAddBtnMouse] = useState<{ x: number; y: number } | null>(null);
  const addBtnRef = React.useRef<HTMLButtonElement>(null);

  const user = auth.currentUser;

  const fetchWallets = async () => {
    if (!user) return;
    setLoading(true);
    const snap = await getDocs(
      collection(db, "wallets", user.uid, "userWallets")
    );
    setWallets(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Wallet))
    );
    setLoading(false);
  };

  const fetchActiveWallet = async () => {
    if (!user) return;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      setActiveWalletId(userDoc.data().activeWallet || null);
    }
  };

  useEffect(() => {
    if (open) {
      fetchWallets();
      fetchActiveWallet();
    }
    // eslint-disable-next-line
  }, [open]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !budget.trim() || isNaN(Number(budget))) {
      setError("Please enter a valid name and budget.");
      return;
    }
    if (!user) return;
    await addDoc(collection(db, "wallets", user.uid, "userWallets"), {
      name: name.trim(),
      budget: Number(budget),
      createdAt: new Date().toISOString(),
    });
    setName("");
    setBudget("");
    fetchWallets();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "wallets", user.uid, "userWallets", id));
    if (activeWalletId === id) {
      await setDoc(
        doc(db, "users", user.uid),
        { activeWallet: null },
        { merge: true }
      );
      setActiveWalletId(null);
    }
    fetchWallets();
    fetchActiveWallet();
  };

  const handleEdit = (wallet: Wallet) => {
    setEditId(wallet.id);
    setEditName(wallet.name);
    setEditBudget(wallet.budget.toString());
  };

  const handleEditSave = async (id: string) => {
    if (!user) return;
    if (!editName.trim() || !editBudget.trim() || isNaN(Number(editBudget))) {
      setError("Please enter a valid name and budget.");
      return;
    }
    await updateDoc(doc(db, "wallets", user.uid, "userWallets", id), {
      name: editName.trim(),
      budget: Number(editBudget),
    });
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
    fetchWallets();
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
  };

  const handleSetActive = async (id: string) => {
    if (!user) return;
    await setDoc(
      doc(db, "users", user.uid),
      { activeWallet: id },
      { merge: true }
    );
    setActiveWalletId(id);
  };

  const totalBudget = wallets.reduce(
    (sum, w) => sum + (Number(w.budget) || 0),
    0
  );
  const sortedWallets = [
    ...wallets.filter((w) => w.id === activeWalletId),
    ...wallets.filter((w) => w.id !== activeWalletId),
  ];

  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Wallets</h2>
        <div className={styles.totalBudget}>
          Total Budget: <span>${totalBudget}</span>
        </div>
        <form onSubmit={handleAddWallet} className={styles.form}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wallet Name"
            className={styles.input}
          />
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Budget"
            type="number"
            min="0"
            className={styles.input}
          />
          <motion.button
            ref={addBtnRef}
            type="submit"
            className={styles.addBtn}
            onMouseMove={(e) => {
              const rect = addBtnRef.current?.getBoundingClientRect();
              if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setAddBtnMouse({ x, y });
              }
            }}
            onMouseLeave={() => setAddBtnMouse(null)}
            style={{
              background: addBtnMouse
                ? `radial-gradient(circle at ${addBtnMouse.x}px ${addBtnMouse.y}px, #fd523b 0%, #ef8a57 100%)`
                : "linear-gradient(90deg, #ef8a57 60%, #fd523b 100%)",
              transition: addBtnMouse ? "background 0.1s" : "background 0.3s",
            }}
            whileHover={{ scale: 1.03 }}
          >
            Add Wallet
          </motion.button>
          {error && <div className={styles.error}>{error}</div>}
        </form>
        <div className={styles.listSection}>
          {loading ? (
            <div>Loading...</div>
          ) : wallets.length === 0 ? (
            <div>No wallets yet.</div>
          ) : (
            <ul className={styles.list}>
              {sortedWallets.map((w) => (
                <li
                  key={w.id}
                  className={
                    w.id === activeWalletId
                      ? `${styles.listItem} ${styles.active}`
                      : styles.listItem
                  }
                >
                  {editId === w.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={styles.editInput}
                      />
                      <input
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        type="number"
                        min="0"
                        className={styles.editInput}
                      />
                      <div className={styles.actions}>
                        <button
                          onClick={() => handleEditSave(w.id)}
                          className={styles.saveBtn}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className={styles.cancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.nameBalance}>
                        <span className={styles.name}>{w.name}</span> -{" "}
                        <span className={styles.balance}>${w.budget}</span>
                        {w.id === activeWalletId && (
                          <span className={styles.activeLabel}>(Active)</span>
                        )}
                      </span>
                      <div className={styles.actions}>
                        <button
                          onClick={() => handleSetActive(w.id)}
                          className={styles.setActiveBtn}
                          disabled={w.id === activeWalletId}
                        >
                          Set Active
                        </button>
                        <button
                          onClick={() => handleEdit(w)}
                          className={styles.editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          className={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          Close
        </button>
      </div>
    </div>
  );
}
