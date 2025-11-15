// src/pages/wallet/WalletPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  FileDown,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  limit,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";

// ⬇️ Adjust if your Sidebar lives elsewhere
import Sidebar from "./components/sidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";

/* ======================= Helpers ======================= */
const peso = (v) => {
  const n = Number(v ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (ts) => {
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    if (typeof ts === "string" || typeof ts === "number") return new Date(ts).toLocaleString();
  } catch {}
  return "—";
};

const Badge = ({ children, kind = "muted" }) => {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : kind === "warning"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : kind === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${styles}`}>
      {children}
    </span>
  );
};

const PillButton = ({ icon: Icon, label, onClick, variant = "primary", disabled }) => {
  const styles =
    variant === "primary"
      ? "bg-blue-600 hover:bg-blue-700 text-white"
      : variant === "ghost"
      ? "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200"
      : "bg-slate-900 hover:bg-black text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl min-h-10 shadow-sm transition disabled:opacity-60 ${styles}`}
    >
      {Icon ? <Icon size={16} className="shrink-0" /> : null}
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
};

const Line = ({ w = "100%" }) => <div className="h-4 rounded bg-slate-200/80 animate-pulse" style={{ width: w }} />;

/* ======================= Minimal Modal ======================= */
function Modal({ open, title, icon: Icon, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow">
            {Icon ? <Icon size={18} /> : <Shield size={18} />}
          </div>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ======================= Row ======================= */
function TxRow({ tx }) {
  const sign = tx.delta >= 0 ? "+" : "–";
  const absAmount = Math.abs(tx.delta);
  const isCredit = tx.delta >= 0;
  const iconBg = isCredit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
  const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;

  const statusKind =
    tx.status === "completed" ? "success" : tx.status === "pending" ? "warning" : "danger";

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className={`h-10 w-10 rounded-xl grid place-items-center ${iconBg}`}>
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">
              {tx.type?.replace("_", " ") || "Transaction"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{formatDate(tx.timestamp)}</div>
            {tx?.method ? (
              <div className="text-xs text-slate-500 mt-0.5">Method: {tx.method}</div>
            ) : null}
            {tx?.counterparty?.email ? (
              <div className="text-xs text-slate-500 mt-0.5">
                Counterparty: {tx.counterparty.displayName || tx.counterparty.email}
              </div>
            ) : null}
            {tx?.note ? <div className="text-xs text-slate-600 mt-1">“{tx.note}”</div> : null}
          </div>

          <div className="text-right shrink-0">
            <div className={`text-base font-semibold ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
              {sign}
              {peso(absAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">Bal: {peso(tx.balanceAfter ?? 0)}</div>
            <div className="mt-1">
              <Badge kind={statusKind}>{tx.status || "completed"}</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Main Page ======================= */
export default function WalletPage() {
  const { sidebarOpen } = useSidebar();
  const navigate = useNavigate();

  const [authReady, setAuthReady] = useState(!!auth.currentUser);
  useEffect(() => {
    const { onAuthStateChanged } = require("firebase/auth");
    const unsub = onAuthStateChanged(auth, (u) => setAuthReady(!!u));
    return unsub;
  }, []);

  // Redirect if not signed in
  useEffect(() => {
    if (authReady && !auth.currentUser) navigate("/");
  }, [authReady, navigate]);

  // Wallet state
  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Transactions state
  const PAGE_SIZE = 15;
  const [allTxs, setAllTxs] = useState([]); // Store all loaded transactions
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const uid = auth.currentUser?.uid;

  // Ensure guest wallet exists + live balance
  useEffect(() => {
    if (!uid) return;
    const wref = doc(database, "guestWallets", uid);

    (async () => {
      try {
        const snap = await getDoc(wref);
        if (!snap.exists()) {
          await setDoc(
            wref,
            { uid, balance: 0, currency: "PHP", updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      } catch (e) {
        console.error("Ensure guest wallet failed", e);
      }
    })();

    const unsub = onSnapshot(wref, (s) => {
      const d = s.data() || { balance: 0, currency: "PHP" };
      setWallet({ balance: Number(d.balance || 0), currency: d.currency || "PHP" });
      setLoadingWallet(false);
    });

    return unsub;
  }, [uid]);

  // Load more transactions from Firestore
  const loadMoreTxs = async () => {
    if (!uid || endReached || txLoading) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const tRef = collection(database, "guestWallets", uid, "transactions");
      let qy = query(tRef, orderBy("timestamp", "desc"), limit(PAGE_SIZE));
      if (lastCursor) {
        qy = query(tRef, orderBy("timestamp", "desc"), startAfter(lastCursor), limit(PAGE_SIZE));
      }

      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      if (rows.length > 0) {
        setAllTxs((prev) => [...prev, ...rows]);
        setLastCursor(snap.docs[snap.docs.length - 1]);
      }
      
      if (snap.docs.length < PAGE_SIZE) {
        setEndReached(true);
      }
    } catch (e) {
      console.error(e);
      setTxError(e?.message || "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  // Load initial transactions
  useEffect(() => {
    if (uid) {
      setCurrentPage(1);
      setLastCursor(null);
      setEndReached(false);
      setAllTxs([]);
      setTxLoading(true);
      setTxError(null);
      
      const loadInitial = async () => {
        try {
          const tRef = collection(database, "guestWallets", uid, "transactions");
          const qy = query(tRef, orderBy("timestamp", "desc"), limit(PAGE_SIZE));
          const snap = await getDocs(qy);
          const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          
          setAllTxs(rows);
          if (snap.docs.length > 0) {
            setLastCursor(snap.docs[snap.docs.length - 1]);
          }
          if (snap.docs.length < PAGE_SIZE) {
            setEndReached(true);
          }
        } catch (e) {
          console.error(e);
          setTxError(e?.message || "Failed to load transactions");
        } finally {
          setTxLoading(false);
        }
      };
      
      loadInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(allTxs.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedTxs = allTxs.slice(startIdx, endIdx);

  // Handle page navigation
  const nextPage = () => {
    const nextPageNum = currentPage + 1;
    const neededItems = nextPageNum * PAGE_SIZE;
    
    // If we need more data and haven't reached the end, load more
    if (neededItems > allTxs.length && !endReached && !txLoading) {
      loadMoreTxs().then(() => {
        setCurrentPage(nextPageNum);
      });
    } else if (nextPageNum <= totalPages) {
      setCurrentPage(nextPageNum);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
    }
  };

  // Filtered view (client side search by type/method/note)
  const filtered = useMemo(() => {
    const f = (filter || "").trim().toLowerCase();
    if (!f) return allTxs; // No filter: search all loaded transactions
    // Has filter: search through all loaded transactions
    return allTxs.filter((t) => {
      const hay =
        `${t.type || ""} ${t.method || ""} ${t.note || ""} ${t?.counterparty?.email || ""}`.toLowerCase();
      return hay.includes(f);
    });
  }, [allTxs, filter]);

  // Pagination for filtered results
  const filteredTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const filteredStartIdx = filter ? (currentPage - 1) * PAGE_SIZE : startIdx;
  const filteredEndIdx = filter ? filteredStartIdx + PAGE_SIZE : endIdx;
  const paginatedFiltered = filter 
    ? filtered.slice(filteredStartIdx, filteredEndIdx)
    : paginatedTxs;

  // Reset to page 1 when filter changes
  useEffect(() => {
    if (filter) {
      setCurrentPage(1);
    }
  }, [filter]);

  /* ======================= Actions (Transactions) ======================= */
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // {kind:'success'|'error', text}

  const popToast = (kind, text) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
  };

  // Add Funds Modal
  const [showAdd, setShowAdd] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addMethod, setAddMethod] = useState("Manual");
  const [addNote, setAddNote] = useState("");

  const handleAddFunds = async () => {
    const amt = Number(addAmount);
    if (!amt || amt <= 0) return popToast("error", "Enter a valid amount.");
    if (!uid) return popToast("error", "Not signed in.");
    setBusy(true);
    try {
      await runTransaction(database, async (tx) => {
        const wref = doc(database, "guestWallets", uid);
        const wSnap = await tx.get(wref);
        const wb = Number(wSnap.data()?.balance || 0);
        const nb = wb + amt;

        const tref = doc(collection(database, "guestWallets", uid, "transactions"));
        tx.set(tref, {
          uid, // <-- satisfy rules expecting ownership on transaction doc
          type: "topup",
          delta: +amt,
          amount: amt,
          status: "completed",
          method: addMethod,
          ...(addNote ? { note: addNote } : {}), // avoid nulls
          // no counterparty field when N/A
          balanceAfter: nb,
          timestamp: serverTimestamp(),
        });

        tx.set(
          wref,
          {
            uid,
            balance: nb,
            currency: "PHP",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      setShowAdd(false);
      setAddAmount("");
      setAddNote("");
      popToast("success", "Funds added.");
    } catch (e) {
      console.error(e);
      popToast("error", e?.code === "permission-denied" ? "Insufficient permissions for this write." : (e?.message || "Add funds failed."));
    } finally {
      setBusy(false);
    }
  };

  // Withdraw Modal
  const [showWd, setShowWd] = useState(false);
  const [wdAmount, setWdAmount] = useState("");
  const [wdMethod, setWdMethod] = useState("Bank");
  const [wdNote, setWdNote] = useState("");

  const handleWithdraw = async () => {
    const amt = Number(wdAmount);
    if (!amt || amt <= 0) return popToast("error", "Enter a valid amount.");
    if (!uid) return popToast("error", "Not signed in.");
    if (amt > wallet.balance) return popToast("error", "Insufficient balance.");
    setBusy(true);
    try {
      await runTransaction(database, async (tx) => {
        const wref = doc(database, "guestWallets", uid);
        const wSnap = await tx.get(wref);
        const wb = Number(wSnap.data()?.balance || 0);
        if (amt > wb) throw new Error("Insufficient balance.");
        const nb = wb - amt;

        const tref = doc(collection(database, "guestWallets", uid, "transactions"));
        tx.set(tref, {
          uid, // <-- satisfy rules
          type: "withdraw",
          delta: -amt,
          amount: amt,
          status: "completed",
          method: wdMethod,
          ...(wdNote ? { note: wdNote } : {}),
          // no counterparty field when N/A
          balanceAfter: nb,
          timestamp: serverTimestamp(),
        });

        tx.set(
          wref,
          { uid, balance: nb, currency: "PHP", updatedAt: serverTimestamp() },
          { merge: true }
        );
      });

      setShowWd(false);
      setWdAmount("");
      setWdNote("");
      popToast("success", "Withdrawal recorded.");
    } catch (e) {
      console.error(e);
      popToast("error", e?.code === "permission-denied" ? "Insufficient permissions for this write." : (e?.message || "Withdrawal failed."));
    } finally {
      setBusy(false);
    }
  };

  // Transfer Modal
  const [showTf, setShowTf] = useState(false);
  const [tfAmount, setTfAmount] = useState("");
  const [tfEmail, setTfEmail] = useState("");
  const [tfNote, setTfNote] = useState("");

  const handleTransfer = async () => {
    const amt = Number(tfAmount);
    const email = (tfEmail || "").trim().toLowerCase();
    if (!amt || amt <= 0) return popToast("error", "Enter a valid amount.");
    if (!uid) return popToast("error", "Not signed in.");
    if (amt > wallet.balance) return popToast("error", "Insufficient balance.");
    if (!email) return popToast("error", "Enter recipient email.");

    setBusy(true);
    try {
      // Find recipient by email
      const uSnap = await getDocs(
        query(collection(database, "users"), where("email", "==", email), limit(1))
      );
      if (uSnap.empty) throw new Error("Recipient not found.");
      const rec = uSnap.docs[0].data();
      const rid = uSnap.docs[0].id;

      const sid = uid;
      if (rid === sid) throw new Error("You cannot transfer to yourself.");

      await runTransaction(database, async (tx) => {
        const sref = doc(database, "guestWallets", sid);
        const rref = doc(database, "guestWallets", rid);

        const sSnap = await tx.get(sref);
        const rSnap = await tx.get(rref);

        const sb = Number(sSnap.data()?.balance || 0);
        if (amt > sb) throw new Error("Insufficient balance.");
        const rb = Number(rSnap.data()?.balance || 0);

        const sNew = sb - amt;
        const rNew = rb + amt;

        // Ensure receiver wallet exists
        if (!rSnap.exists()) {
          tx.set(rref, { uid: rid, balance: 0, currency: "PHP", updatedAt: serverTimestamp() }, { merge: true });
        }

        const txId = doc(collection(database, "_ids")).id; // cheap unique id

        const senderCounterparty = {
          uid: rid,
          ...(rec.email ? { email: rec.email } : {}),
          ...(rec.displayName ? { displayName: rec.displayName } : {}),
        };
        const recipientCounterparty = {
          uid: sid,
          ...(auth.currentUser?.email ? { email: auth.currentUser.email } : {}),
          ...(auth.currentUser?.displayName ? { displayName: auth.currentUser.displayName } : {}),
        };

        // Sender transaction (debit)
        const sTxRef = doc(collection(database, "guestWallets", sid, "transactions"));
        tx.set(sTxRef, {
          uid: sid, // <-- satisfy rules on sender tx doc
          type: "transfer_out",
          delta: -amt,
          amount: amt,
          status: "completed",
          method: "internal",
          ...(tfNote ? { note: tfNote } : {}),
          counterparty: senderCounterparty,
          sharedId: txId,
          balanceAfter: sNew,
          timestamp: serverTimestamp(),
        });

        // Recipient transaction (credit)
        const rTxRef = doc(collection(database, "guestWallets", rid, "transactions"));
        tx.set(rTxRef, {
          uid: rid, // <-- satisfy rules on recipient tx doc
          type: "transfer_in",
          delta: +amt,
          amount: amt,
          status: "completed",
          method: "internal",
          ...(tfNote ? { note: tfNote } : {}),
          counterparty: recipientCounterparty,
          sharedId: txId,
          balanceAfter: rNew,
          timestamp: serverTimestamp(),
        });

        // Apply balances
        tx.set(sref, { uid: sid, balance: sNew, currency: "PHP", updatedAt: serverTimestamp() }, { merge: true });
        tx.set(rref, { uid: rid, balance: rNew, currency: "PHP", updatedAt: serverTimestamp() }, { merge: true });
      });

      setShowTf(false);
      setTfAmount("");
      setTfEmail("");
      setTfNote("");
      popToast("success", "Transfer completed.");
    } catch (e) {
      console.error(e);
      popToast("error", e?.code === "permission-denied" ? "Insufficient permissions for this write." : (e?.message || "Transfer failed."));
    } finally {
      setBusy(false);
    }
  };

  // CSV export
  const exportCSV = () => {
    const header = [
      "date",
      "type",
      "status",
      "method",
      "note",
      "counterparty",
      "delta",
      "balanceAfter",
    ];
    const lines = [header.join(",")];

    allTxs.forEach((t) => {
      const row = [
        JSON.stringify(formatDate(t.timestamp)),
        JSON.stringify(t.type || ""),
        JSON.stringify(t.status || ""),
        JSON.stringify(t.method || ""),
        JSON.stringify(t.note || ""),
        JSON.stringify(t?.counterparty?.email || ""),
        (t.delta >= 0 ? "+" : "-") + Number(Math.abs(t.delta)).toFixed(2),
        Number(t.balanceAfter ?? 0).toFixed(2),
      ];
      lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wallet-transactions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyWalletId = async () => {
    if (!uid) return;
    await navigator.clipboard.writeText(uid);
    popToast("success", "Wallet ID copied.");
  };

  /* ======================= Render ======================= */
  const balanceCard = (
    <div className="rounded-3xl border border-slate-200 bg-white/80 shadow p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow">
            <WalletIcon size={18} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Available Balance</div>
            <div className="text-2xl font-bold text-slate-900">
              {loadingWallet ? <Line w="120px" /> : peso(wallet.balance)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PillButton icon={Plus} label="Add funds" onClick={() => setShowAdd(true)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>Currency: {wallet.currency || "PHP"}</Badge>
        <button
          onClick={copyWalletId}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
        >
          <Copy size={14} />
          Wallet ID
        </button>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white hover:bg-slate-50"
        >
          <FileDown size={14} />
          Export CSV
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Top header */}
      <header
        className={`fixed top-0 right-0 z-30 bg-white border-b border-gray-200 shadow-sm transition-all duration-300 left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-gray-800 text-xl">E-Wallet</div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
            Secure • Instant ledger • CSV export
          </div>
        </div>
      </header>

      {/* Spacer */}
      <div className="h-[56px]" />

      {/* Main */}
      <main
        className={`transition-[margin] duration-300 ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-20"} px-4 sm:px-6 lg:px-12 py-6`}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Balance + actions */}
          {balanceCard}

          {/* Search */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 shadow p-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search size={16} />
                </div>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search transactions by type, method, note, or email…"
                  className="pl-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <div className="hidden sm:block text-xs text-slate-500">
                Showing {filtered.length} of {allTxs.length}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className="rounded-3xl border border-slate-200 bg-white/80 shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">Recent Activity</h4>
              {txLoading && (
                <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </span>
              )}
            </div>

            {txError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm inline-flex items-center gap-2">
                <AlertCircle size={16} /> {txError}
              </div>
            ) : paginatedFiltered.length ? (
              <div className="divide-y divide-slate-100">
                {paginatedFiltered.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </div>
            ) : txLoading ? (
              <div className="space-y-3">
                <Line />
                <Line w="90%" />
                <Line w="80%" />
              </div>
            ) : (
              <p className="text-sm text-slate-600">No transactions yet.</p>
            )}

            {/* Pagination */}
            {allTxs.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="text-xs sm:text-sm text-slate-600">
                  {filter ? (
                    <>
                      Showing{" "}
                      <span className="font-medium text-slate-800">
                        {filteredStartIdx + 1}–{Math.min(filteredEndIdx, filtered.length)}
                      </span>{" "}
                      of <span className="font-medium text-slate-800">{filtered.length}</span> results
                      {filtered.length < allTxs.length && (
                        <> (from {allTxs.length} loaded)</>
                      )}
                    </>
                  ) : (
                    <>
                      Showing{" "}
                      <span className="font-medium text-slate-800">
                        {startIdx + 1}–{Math.min(endIdx, allTxs.length)}
                      </span>{" "}
                      of <span className="font-medium text-slate-800">{allTxs.length}</span> loaded
                      {!endReached && " (more available)"}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {filter ? (
                    <>
                      <button
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <ChevronLeft size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Prev</span>
                      </button>
                      <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap">
                        Page {currentPage} / {filteredTotalPages}
                      </span>
                      <button
                        disabled={currentPage >= filteredTotalPages}
                        onClick={() => setCurrentPage((p) => Math.min(filteredTotalPages, p + 1))}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <span className="hidden sm:inline">Next</span> <ChevronRight size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        disabled={currentPage <= 1}
                        onClick={prevPage}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <ChevronLeft size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Prev</span>
                      </button>
                      <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap">
                        Page {currentPage} / {totalPages}
                      </span>
                      <button
                        disabled={currentPage >= totalPages && endReached}
                        onClick={nextPage}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <span className="hidden sm:inline">Next</span> <ChevronRight size={14} className="sm:w-4 sm:h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70]">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow border ${
              toast.kind === "success"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {toast.kind === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.text}
          </div>
        </div>
      )}

      {/* ===== Modals ===== */}
      {/* Add Funds */}
      <Modal open={showAdd} title="Add Funds" icon={Plus} onClose={() => !busy && setShowAdd(false)}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-700">Amount (PHP)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Method</span>
            <select
              value={addMethod}
              onChange={(e) => setAddMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              <option>Manual</option>
              <option>GCash</option>
              <option>Bank</option>
              <option>Card</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Note (optional)</span>
            <input
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="reference / memo"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <PillButton variant="ghost" label="Cancel" onClick={() => setShowAdd(false)} disabled={busy} />
            <PillButton icon={Plus} label={busy ? "Processing…" : "Add funds"} onClick={handleAddFunds} disabled={busy} />
          </div>

          <div className="text-xs text-slate-500">
            In production, initiate with <em>pending</em> status and mark <em>completed</em> after your PSP webhook.
          </div>
        </div>
      </Modal>

      {/* Withdraw */}
      <Modal open={showWd} title="Withdraw" icon={ArrowUpRight} onClose={() => !busy && setShowWd(false)}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-700">Amount (PHP)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Payout Method</span>
            <select
              value={wdMethod}
              onChange={(e) => setWdMethod(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
            >
              <option>Bank</option>
              <option>GCash</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Note (optional)</span>
            <input
              value={wdNote}
              onChange={(e) => setWdNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="reference / memo"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <PillButton variant="ghost" label="Cancel" onClick={() => setShowWd(false)} disabled={busy} />
            <PillButton icon={ArrowUpRight} label={busy ? "Processing…" : "Withdraw"} onClick={handleWithdraw} disabled={busy} />
          </div>

          <div className="text-xs text-slate-500">
            In production, create a payout request and mark complete after settlement.
          </div>
        </div>
      </Modal>

      {/* Transfer */}
      <Modal open={showTf} title="Transfer to another user" icon={Send} onClose={() => !busy && setShowTf(false)}>
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm text-slate-700">Recipient Email</span>
            <input
              type="email"
              value={tfEmail}
              onChange={(e) => setTfEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="recipient@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Amount (PHP)</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={tfAmount}
              onChange={(e) => setTfAmount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="0.00"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700">Note (optional)</span>
            <input
              value={tfNote}
              onChange={(e) => setTfNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
              placeholder="reference / memo"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <PillButton variant="ghost" label="Cancel" onClick={() => setShowTf(false)} disabled={busy} />
            <PillButton icon={Send} label={busy ? "Processing…" : "Send"} onClick={handleTransfer} disabled={busy} />
          </div>

          <div className="text-xs text-slate-500">
            Transfers are atomic and update both wallets in a single Firestore transaction.
          </div>
        </div>
      </Modal>
    </div>
  );
}
