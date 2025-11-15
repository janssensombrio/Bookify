// src/pages/host/wallet-page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
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
  limit,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";

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
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon ? <Icon size={20} className="text-blue-600" /> : null}
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <AlertCircle size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function HostWalletPage() {
  const navigate = useNavigate();

  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });
  const [loadingWallet, setLoadingWallet] = useState(true);

  const [allTxs, setAllTxs] = useState([]);
  const PAGE_SIZE = 20;
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const uid = auth.currentUser?.uid;

  // Ensure host wallet exists + live balance
  useEffect(() => {
    if (!uid) return;
    const wref = doc(database, "hostWallets", uid);

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
        console.error("Ensure host wallet failed", e);
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
      const tRef = collection(database, "hostWallets", uid, "transactions");
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
      setTxLoading(true);
      setTxError(null);
      
      const loadInitial = async () => {
        try {
          const tRef = collection(database, "hostWallets", uid, "transactions");
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
  }, [uid]);

  // Pagination calculations
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const paginatedTxs = allTxs.slice(startIdx, endIdx);
  const totalPages = Math.max(1, Math.ceil(allTxs.length / PAGE_SIZE));

  const nextPage = () => {
    const nextPageNum = currentPage + 1;
    if (nextPageNum > totalPages && !endReached && !txLoading) {
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
    if (!f) return allTxs;
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
  const [toast, setToast] = useState(null);

  const popToast = (kind, text) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
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
        const wref = doc(database, "hostWallets", uid);
        const wSnap = await tx.get(wref);
        const wb = Number(wSnap.data()?.balance || 0);
        if (amt > wb) throw new Error("Insufficient balance.");
        const nb = wb - amt;

        const tref = doc(collection(database, "hostWallets", uid, "transactions"));
        tx.set(tref, {
          uid,
          type: "withdraw",
          delta: -amt,
          amount: amt,
          status: "completed",
          method: wdMethod,
          ...(wdNote ? { note: wdNote } : {}),
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

  // Export to CSV
  const exportToCSV = () => {
    const rows = filtered.length > 0 ? filtered : allTxs;
    const headers = ["Date", "Type", "Amount", "Status", "Method", "Note"];
    const csvRows = [
      headers.join(","),
      ...rows.map((t) => {
        const date = formatDate(t.timestamp);
        const type = (t.type || "").replace(/_/g, " ");
        const amount = t.delta >= 0 ? `+${peso(t.amount)}` : `-${peso(t.amount)}`;
        const status = t.status || "—";
        const method = t.method || "—";
        const note = (t.note || "").replace(/"/g, '""');
        return `"${date}","${type}","${amount}","${status}","${method}","${note}"`;
      }),
    ];
    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `host-wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
                {tx.type?.replace(/_/g, " ") || "Transaction"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{formatDate(tx.timestamp)}</div>
              {tx?.method ? (
                <div className="text-xs text-slate-500 mt-0.5">Method: {tx.method}</div>
              ) : null}
              {tx?.note ? <div className="text-xs text-slate-600 mt-1">"{tx.note}"</div> : null}
              {tx?.counterparty?.email ? (
                <div className="text-xs text-slate-500 mt-0.5">
                  {isCredit ? "From" : "To"}: {tx.counterparty.email}
                </div>
              ) : null}
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                {sign}
                {peso(absAmount)}
              </div>
              <Badge kind={statusKind} className="mt-1">
                {tx.status || "—"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Host Wallet</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your hosting earnings and withdrawals</p>
        </div>
        <div className="flex items-center gap-2">
          <PillButton icon={FileDown} label="Export CSV" onClick={exportToCSV} variant="ghost" />
          <PillButton
            icon={Plus}
            label="Withdraw"
            onClick={() => setShowWd(true)}
            disabled={busy || loadingWallet || wallet.balance <= 0}
          />
        </div>
      </div>

      {/* Balance Card */}
      <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 font-medium">Host Wallet Balance</p>
            {loadingWallet ? (
              <Line w="120px" className="mt-2" />
            ) : (
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">{peso(wallet.balance)}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">Currency: {wallet.currency}</p>
          </div>
          <div className="p-4 rounded-2xl bg-blue-100/80">
            <WalletIcon size={32} className="text-blue-600" />
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {txLoading && allTxs.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Line w="40px" />
                <div className="flex-1">
                  <Line w="60%" />
                  <Line w="40%" className="mt-2" />
                </div>
                <Line w="80px" />
              </div>
            ))}
          </div>
        ) : txError ? (
          <div className="text-center py-8 text-red-600">
            <AlertCircle size={24} className="mx-auto mb-2" />
            <p>{txError}</p>
          </div>
        ) : paginatedFiltered.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <WalletIcon size={48} className="mx-auto mb-2 opacity-50" />
            <p>No transactions found.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {paginatedFiltered.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {filteredStartIdx + 1}–{Math.min(filteredEndIdx, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft size={18} />
                </button>
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-sm text-slate-600 px-3">
                  Page {currentPage} of {filteredTotalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage >= filteredTotalPages && endReached}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => goToPage(filteredTotalPages)}
                  disabled={currentPage >= filteredTotalPages && endReached}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Withdraw Modal */}
      <Modal open={showWd} title="Withdraw Funds" icon={ArrowUpRight} onClose={() => !busy && setShowWd(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={busy}
            />
            <p className="text-xs text-slate-500 mt-1">Available: {peso(wallet.balance)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Method</label>
            <select
              value={wdMethod}
              onChange={(e) => setWdMethod(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={busy}
            >
              <option value="Bank">Bank Transfer</option>
              <option value="PayPal">PayPal</option>
              <option value="GCash">GCash</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <textarea
              value={wdNote}
              onChange={(e) => setWdNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={busy}
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <PillButton
              label={busy ? "Processing…" : "Withdraw"}
              onClick={handleWithdraw}
              disabled={busy || !wdAmount || Number(wdAmount) <= 0}
            />
            <button
              onClick={() => setShowWd(false)}
              disabled={busy}
              className="px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-xl transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
            toast.kind === "success" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.kind === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}

