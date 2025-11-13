// src/pages/admin/wallet.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet as WalletIcon,
  FileDown,
  Copy,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  Shield,
  ArrowDownLeft,
  ArrowUpRight,
  Menu,
} from "lucide-react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  limit,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import AdminSidebar from "./components/AdminSidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";

// Admin wallet ID constant
const ADMIN_WALLET_ID = "admin";

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

const Line = ({ w = "100%" }) => <div className="h-4 rounded bg-slate-200/80 animate-pulse" style={{ width: w }} />;

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
            {tx?.metadata?.bookingId ? (
              <div className="text-xs text-slate-500 mt-0.5">Booking: {tx.metadata.bookingId.slice(0, 8)}…</div>
            ) : null}
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
export default function AdminWalletPage() {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const navigate = useNavigate();
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";

  const [authReady, setAuthReady] = useState(!!auth.currentUser);
  useEffect(() => {
    const { onAuthStateChanged } = require("firebase/auth");
    const unsub = onAuthStateChanged(auth, (u) => setAuthReady(!!u));
    return unsub;
  }, []);

  // Wallet state
  const [wallet, setWallet] = useState({ balance: 0, currency: "PHP" });
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Transactions state
  const PAGE = 15;
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [filter, setFilter] = useState("");

  // Ensure admin wallet exists + live balance
  useEffect(() => {
    const wref = doc(database, "wallets", ADMIN_WALLET_ID);

    (async () => {
      try {
        const snap = await getDoc(wref);
        if (!snap.exists()) {
          await setDoc(
            wref,
            { uid: ADMIN_WALLET_ID, balance: 0, currency: "PHP", updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      } catch (e) {
        console.error("Ensure admin wallet failed", e);
      }
    })();

    const unsub = onSnapshot(wref, (s) => {
      const d = s.data() || { balance: 0, currency: "PHP" };
      setWallet({ balance: Number(d.balance || 0), currency: d.currency || "PHP" });
      setLoadingWallet(false);
    });

    return unsub;
  }, []);

  // Load first page of txs
  const loadTxs = async (more = false) => {
    setTxLoading(true);
    setTxError(null);
    try {
      const tRef = collection(database, "wallets", ADMIN_WALLET_ID, "transactions");
      let qy = query(tRef, orderBy("timestamp", "desc"), limit(PAGE));
      if (more && lastCursor) qy = query(tRef, orderBy("timestamp", "desc"), startAfter(lastCursor), limit(PAGE));

      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (more) {
        setTxs((prev) => [...prev, ...rows]);
      } else {
        setTxs(rows);
      }
      if (snap.docs.length < PAGE) {
        setEndReached(true);
      } else {
        setEndReached(false);
      }
      setLastCursor(snap.docs[snap.docs.length - 1] || null);
    } catch (e) {
      console.error(e);
      setTxError(e?.message || "Failed to load transactions");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    loadTxs(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered view (client side search by type/method/note)
  const filtered = useMemo(() => {
    const f = (filter || "").trim().toLowerCase();
    if (!f) return txs;
    return txs.filter((t) => {
      const hay =
        `${t.type || ""} ${t.method || ""} ${t.note || ""} ${t?.metadata?.bookingId || ""}`.toLowerCase();
      return hay.includes(f);
    });
  }, [txs, filter]);

  // CSV export
  const exportCSV = () => {
    const header = [
      "date",
      "type",
      "status",
      "method",
      "note",
      "bookingId",
      "delta",
      "balanceAfter",
    ];
    const lines = [header.join(",")];

    txs.forEach((t) => {
      const row = [
        JSON.stringify(formatDate(t.timestamp)),
        JSON.stringify(t.type || ""),
        JSON.stringify(t.status || ""),
        JSON.stringify(t.method || ""),
        JSON.stringify(t.note || ""),
        JSON.stringify(t?.metadata?.bookingId || ""),
        (t.delta >= 0 ? "+" : "-") + Number(Math.abs(t.delta)).toFixed(2),
        Number(t.balanceAfter ?? 0).toFixed(2),
      ];
      lines.push(row.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "admin-wallet-transactions.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyWalletId = async () => {
    await navigator.clipboard.writeText(ADMIN_WALLET_ID);
    // Simple toast
    const toast = document.createElement("div");
    toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow border bg-emerald-50 text-emerald-700 border-emerald-200";
    toast.textContent = "Wallet ID copied.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  };

  /* ======================= Render ======================= */
  const balanceCard = (
    <div className="glass rounded-3xl border border-white/40 bg-white/80 shadow-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow">
            <WalletIcon size={18} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Admin Wallet Balance</div>
            <div className="text-2xl font-bold text-slate-900">
              {loadingWallet ? <Line w="120px" /> : peso(wallet.balance)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl min-h-10 shadow-sm transition bg-white hover:bg-slate-50 text-slate-800 border border-slate-200"
          >
            <FileDown size={16} />
            <span className="font-medium text-sm">Export CSV</span>
          </button>
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
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      <AdminSidebar />
      {/* Content area wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${sideOffset}`}>
        {/* Top bar — sticky */}
        <header className="fixed top-0 right-0 z-30 bg-white text-gray-800 border-b border-gray-200 shadow-sm transition-all duration-300 left-0">
          <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-4 md:px-8 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                aria-expanded={sidebarOpen}
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none" onClick={() => navigate("/admin-dashboard")}>
                <BookifyLogo />
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">E-Wallet</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
              Service Fees • Platform Revenue • CSV Export
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 px-4 sm:px-6 lg:px-12 py-6">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            {/* Balance + actions */}
            {balanceCard}

            {/* Search */}
            <div className="glass rounded-3xl border border-white/40 bg-white/80 shadow-lg p-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search size={16} />
                  </div>
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Search transactions by type, method, note, or booking ID…"
                    className="pl-9 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div className="hidden sm:block text-xs text-slate-500">
                  Showing {filtered.length} of {txs.length}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="glass rounded-3xl border border-white/40 bg-white/80 shadow-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-slate-900">Service Fee Transactions</h4>
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
              ) : filtered.length ? (
                <div className="divide-y divide-slate-100">
                  {filtered.map((t) => (
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

              <div className="mt-4 flex items-center justify-center">
                {!endReached && !txLoading ? (
                  <button
                    onClick={() => loadTxs(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl min-h-10 shadow-sm transition bg-white hover:bg-slate-50 text-slate-800 border border-slate-200"
                  >
                    <span className="font-medium text-sm">Load more</span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

