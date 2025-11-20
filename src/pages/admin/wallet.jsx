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
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Calendar,
  Printer,
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
  runTransaction,
  where,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";
import AdminSidebar from "./components/AdminSidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";
import DateRangeFilter from "./components/DateRangeFilter.jsx";
import PDFPreviewModal from "../../components/PDFPreviewModal.jsx";
import BookifyIcon from "../../media/favorite.png";

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
  const PAGE_SIZE = 15;
  const [allTxs, setAllTxs] = useState([]); // Store all loaded transactions
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [filter, setFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPreview, setPdfPreview] = useState({ open: false, htmlContent: "", filename: "" });
  
  // Filter states
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeFilter, setTimeFilter] = useState("all"); // all | today | week | month | year
  const [showFilters, setShowFilters] = useState(false);
  const [confirmingTx, setConfirmingTx] = useState(null); // Track which transaction is being confirmed
  const [confirmedTxIds, setConfirmedTxIds] = useState(() => {
    // Load confirmed transaction IDs from localStorage on mount
    try {
      const stored = localStorage.getItem("adminWalletConfirmedTxIds");
      if (stored) {
        const ids = JSON.parse(stored);
        return new Set(Array.isArray(ids) ? ids : []);
      }
    } catch (e) {
      console.error("Failed to load confirmed transaction IDs from localStorage:", e);
    }
    return new Set();
  }); // Track confirmed transaction IDs
  const [hostNames, setHostNames] = useState(new Map()); // Map of hostUid -> hostName

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

  // Load more transactions from Firestore
  const loadMoreTxs = async () => {
    if (endReached || txLoading) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const tRef = collection(database, "wallets", ADMIN_WALLET_ID, "transactions");
      let qy = query(tRef, orderBy("timestamp", "desc"), limit(PAGE_SIZE));
      if (lastCursor) {
        qy = query(tRef, orderBy("timestamp", "desc"), startAfter(lastCursor), limit(PAGE_SIZE));
      }

      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      if (rows.length > 0) {
        setAllTxs((prev) => [...prev, ...rows]);
        setLastCursor(snap.docs[snap.docs.length - 1]);
        
        // Fetch host names for newly loaded transactions
        await fetchHostNames(rows);
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

  // Fetch host names for transactions
  const fetchHostNames = async (transactions) => {
    const hostUids = new Set();
    transactions.forEach((tx) => {
      const hostUid = tx?.metadata?.hostUid;
      if (hostUid) hostUids.add(hostUid);
    });

    if (hostUids.size === 0) return;

    try {
      const hostMap = new Map();
      const hostUidArray = Array.from(hostUids);
      
      // Firestore 'in' queries are limited to 10 items, so we need to batch
      const batchSize = 10;
      for (let i = 0; i < hostUidArray.length; i += batchSize) {
        const batch = hostUidArray.slice(i, i + batchSize);
        const hostQuery = query(collection(database, "hosts"), where("uid", "in", batch));
        const hostSnap = await getDocs(hostQuery);
        
        hostSnap.docs.forEach((doc) => {
          const data = doc.data() || {};
          const uid = data.uid || doc.id;
          const name =
            data.displayName ||
            [data.firstName, data.lastName].filter(Boolean).join(" ") ||
            data.email ||
            uid;
          if (name) hostMap.set(uid, name);
        });
      }

      setHostNames((prev) => {
        const newMap = new Map(prev);
        hostMap.forEach((name, uid) => newMap.set(uid, name));
        return newMap;
      });
    } catch (error) {
      console.error("Failed to fetch host names:", error);
    }
  };

  // Load initial transactions
  useEffect(() => {
    setCurrentPage(1);
    setLastCursor(null);
    setEndReached(false);
    setAllTxs([]);
    setTxLoading(true);
    setTxError(null);
    
    const loadInitial = async () => {
      try {
        const tRef = collection(database, "wallets", ADMIN_WALLET_ID, "transactions");
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
        
        // Fetch host names for loaded transactions
        await fetchHostNames(rows);
      } catch (e) {
        console.error(e);
        setTxError(e?.message || "Failed to load transactions");
      } finally {
        setTxLoading(false);
      }
    };
    
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Filtered view (client side search by type/method/note + filters)
  const filtered = useMemo(() => {
    let result = allTxs;
    
    // Text search filter
    const f = (filter || "").trim().toLowerCase();
    if (f) {
      result = result.filter((t) => {
        const hay =
          `${t.type || ""} ${t.method || ""} ${t.note || ""} ${t?.metadata?.bookingId || ""}`.toLowerCase();
        return hay.includes(f);
      });
    }
    
    // Payment method filter
    if (paymentMethodFilter !== "all") {
      result = result.filter((t) => {
        const method = (t.method || "").toLowerCase();
        return method === paymentMethodFilter.toLowerCase();
      });
    }
    
    // Category/Type filter
    if (categoryFilter !== "all") {
      result = result.filter((t) => {
        const type = (t.type || "").toLowerCase();
        return type === categoryFilter.toLowerCase();
      });
    }
    
    // User type filter (guest or host)
    if (userTypeFilter !== "all") {
      result = result.filter((t) => {
        const hasPayerUid = !!(t?.metadata?.payerUid);
        const hasHostUid = !!(t?.metadata?.hostUid);
        
        if (userTypeFilter === "guest") {
          // Guest transactions have payerUid (the guest who paid)
          return hasPayerUid;
        } else if (userTypeFilter === "host") {
          // Host-related transactions have hostUid
          return hasHostUid && !hasPayerUid;
        }
        return true;
      });
    }
    
    // time filter (takes precedence over dateRange if set)
    if (timeFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let timeRange = null;
      
      switch (timeFilter) {
        case "today":
          timeRange = { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
          break;
        case "week": {
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - dayOfWeek);
          timeRange = { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) };
          break;
        }
        case "month": {
          timeRange = { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
          break;
        }
        case "year": {
          timeRange = { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
          break;
        }
      }
      
      if (timeRange) {
        result = result.filter((t) => {
          try {
            const txDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            return txDate >= timeRange.start && txDate < timeRange.end;
          } catch {
            return false;
          }
        });
      }
    } else {
      // Date range filter (only if timeFilter is "all")
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        startDate.setHours(0, 0, 0, 0);
        result = result.filter((t) => {
          try {
            const txDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            return txDate >= startDate;
          } catch {
            return false;
          }
        });
      }
      
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        result = result.filter((t) => {
          try {
            const txDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            return txDate <= endDate;
          } catch {
            return false;
          }
        });
      }
    }
    
    return result;
  }, [allTxs, filter, paymentMethodFilter, categoryFilter, userTypeFilter, dateRange, timeFilter]);

  // Get unique payment methods and categories from transactions
  const uniqueMethods = useMemo(() => {
    const methods = new Set();
    allTxs.forEach((t) => {
      if (t.method) methods.add(t.method);
    });
    return Array.from(methods).sort();
  }, [allTxs]);
  
  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    allTxs.forEach((t) => {
      if (t.type) categories.add(t.type);
    });
    return Array.from(categories).sort();
  }, [allTxs]);
  
  // Check if any filters are active
  const hasActiveFilters = paymentMethodFilter !== "all" || 
    categoryFilter !== "all" || 
    userTypeFilter !== "all" || 
    timeFilter !== "all" ||
    dateRange.start || 
    dateRange.end;
  
  // Pagination for filtered results
  const filteredTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const filteredStartIdx = hasActiveFilters || filter ? (currentPage - 1) * PAGE_SIZE : startIdx;
  const filteredEndIdx = hasActiveFilters || filter ? filteredStartIdx + PAGE_SIZE : endIdx;
  const paginatedFiltered = hasActiveFilters || filter
    ? filtered.slice(filteredStartIdx, filteredEndIdx)
    : paginatedTxs;

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, paymentMethodFilter, categoryFilter, userTypeFilter, dateRange, timeFilter]);
  
  // Get time filter label for display
  const getTimeFilterLabel = (filter) => {
    switch (filter) {
      case "today": return "Today";
      case "week": return "This Week";
      case "month": return "This Month";
      case "year": return "This Year";
      default: return "All Time";
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setPaymentMethodFilter("all");
    setCategoryFilter("all");
    setUserTypeFilter("all");
    setDateRange({ start: "", end: "" });
    setTimeFilter("all");
    setFilter("");
  };

  // Print transactions
  const printTable = () => {
    try {
      const rows = filtered || [];
      const escapeHtml = (str) => {
        if (str == null) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      const nowStr = new Date().toLocaleString();
      const timeFilterLabel = getTimeFilterLabel(timeFilter);
      const formatPeso = (v) => {
        const n = Number(v || 0);
        if (!Number.isFinite(n)) return "—";
        return `₱${n.toLocaleString()}`;
      };
      const formatDate = (ts) => {
        if (!ts) return "—";
        const d = ts?.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleString();
      };

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Transaction History</title>
  <style>
    @page { margin: 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.5 system-ui, -apple-system, sans-serif; color: #0f172a; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand h1 { font-size: 18px; margin: 0; }
    .brand small { color: #64748b; display: block; font-size: 12px; }
    .meta { text-align: right; color: #64748b; font-size: 11px; }
    .summary { margin: 16px 0; padding: 12px; background: #f8fafc; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    thead { background: #f1f5f9; }
    th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #334155; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f8fafc; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; color: #475569; }
    .num { text-align: right; }
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <h1>Bookify <small>Transaction History</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Period: ${escapeHtml(timeFilterLabel)}<br/>
      Total: ${rows.length.toLocaleString()} transactions
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Method</th>
        <th>Host Name</th>
        <th class="num">Amount</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((t) => {
        const date = formatDate(t.timestamp || t.createdAt);
        const hostName = t?.metadata?.hostUid ? (hostNames.get(t.metadata.hostUid) || "—") : "—";
        const amount = formatPeso(t.amount || t.delta);
        return `<tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(t.type || "—")}</td>
          <td>${escapeHtml(t.method || "—")}</td>
          <td>${escapeHtml(hostName)}</td>
          <td class="num">${escapeHtml(amount)}</td>
          <td>${escapeHtml(t.note || "—")}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="footer">
    Bookify • Transaction History • Generated on ${escapeHtml(nowStr)}
  </div>
</body>
</html>`;

      const win = window.open("", "_blank");
      if (!win) {
        alert("Unable to open print window. Please allow popups for this site.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 250);
    } catch (e) {
      console.error("Failed to print", e);
      alert("Failed to print: " + String(e));
    }
  };

  // Generate HTML content for PDF
  const generatePDFHTML = () => {
    const rows = filtered || [];
    const escapeHtml = (str) => {
      if (str == null) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    };

    const formatPesoSafe = (v) => {
      const n = Number(v || 0);
      if (!Number.isFinite(n)) return "—";
      return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const nowStr = new Date().toLocaleString();
    const timeFilterLabel = getTimeFilterLabel(timeFilter);
    const totalTransactions = rows.length;
    const totalCredits = rows.filter((t) => t.delta >= 0).reduce((sum, t) => sum + Math.abs(t.delta), 0);
    const totalDebits = rows.filter((t) => t.delta < 0).reduce((sum, t) => sum + Math.abs(t.delta), 0);
    const completedCount = rows.filter((t) => t.status === "completed").length;

    const html = [];
    html.push(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Wallet Transactions Report</title>
  <style>
    :root{
      --brand:#2563eb; --ink:#0f172a; --muted:#64748b; --line:#e5e7eb; --bg:#ffffff;
      --subtle:#f8fafc; --thead:#f1f5f9;
    }
    @page{ margin: 18mm; }
    *{-webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box;}
    body{ margin:0; padding:20px; font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }

    .header{ display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--line); }
    .brand{ display:flex; align-items:center; gap:12px; }
    .brand img{ width:28px; height:28px; border-radius:6px; object-fit:cover; }
    .brand h1{ font-size:16px; line-height:1.1; margin:0; }
    .brand small{ color:var(--muted); display:block; font-weight:500; }
    .meta{ text-align:right; color:var(--muted); font-size:11px; }

    .chips{ display:flex; flex-wrap:wrap; gap:8px; margin:12px 0 18px; }
    .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid var(--line); border-radius:999px; background:#fff; font-size:11px; color:#1f2937; }
    .chip b{ font-size:12px; color:#0f172a; }
    .chip .dot{ width:8px; height:8px; border-radius:50%; background:var(--brand); display:inline-block; }

    table{ width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    thead{ background:var(--thead); display: table-header-group; }
    thead th{ text-align:left; padding:10px 12px; font-size:11px; color:#334155; border-bottom:1px solid var(--line); font-weight:600; }
    tbody td{ padding:10px 12px; border-bottom:1px solid var(--line); background:#fff; vertical-align:top; }
    tbody tr:nth-child(even) td{ background:var(--subtle); }
    .mono{ font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-size:11px; color:#475569; }
    .num{ text-align:right; }
    .status{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:600; border:1px solid var(--line); background:#fff; color:#1f2937; }
    .status .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
    .dot.completed{ background:#10b981; }
    .dot.pending{ background:#f59e0b; }
    .dot.failed{ background:#ef4444; }
    .method{ display:inline-flex; align-items:center; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:500; background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; }
    .credit{ color:#10b981; }
    .debit{ color:#ef4444; }

    .footer{ position:fixed; bottom:10mm; left:18mm; right:18mm; color:var(--muted); font-size:11px; display:flex; justify-content:space-between; }
    tfoot{ display: table-footer-group; }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Wallet Transactions Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Period: ${escapeHtml(timeFilterLabel)}<br/>
      Rows: ${totalTransactions.toLocaleString()}
    </div>
  </div>

  <div class="chips">
    <span class="chip"><span class="dot"></span><b>Total Transactions:</b> ${totalTransactions.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Total Credits:</b> ${formatPesoSafe(totalCredits)}</span>
    <span class="chip"><span class="dot"></span><b>Total Debits:</b> ${formatPesoSafe(totalDebits)}</span>
    <span class="chip"><span class="dot"></span><b>Completed:</b> ${completedCount.toLocaleString()}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:15%;">Type</th>
        <th style="width:12%;">Date</th>
        <th style="width:10%;">Method</th>
        <th style="width:12%;">Host Name</th>
        <th class="num" style="width:10%;">Amount</th>
        <th class="num" style="width:10%;">Balance</th>
        <th style="width:8%;">Status</th>
        <th style="width:23%;">Details</th>
      </tr>
    </thead>
    <tbody>`);

    for (const t of rows) {
      const sign = t.delta >= 0 ? "+" : "–";
      const absAmount = Math.abs(t.delta);
      const isCredit = t.delta >= 0;
      const statusClass = t.status === "completed" ? "completed" : t.status === "pending" ? "pending" : "failed";
      const amountClass = isCredit ? "credit" : "debit";
      const hostName = t?.metadata?.hostUid ? (hostNames.get(t.metadata.hostUid) || "—") : "—";

      html.push(`<tr>
        <td>${escapeHtml(t.type?.replace(/_/g, " ") || "Transaction")}</td>
        <td>${escapeHtml(formatDate(t.timestamp))}</td>
        <td>${t.method ? `<span class="method">${escapeHtml(t.method)}</span>` : "—"}</td>
        <td>${escapeHtml(hostName)}</td>
        <td class="num ${amountClass}">${sign}${escapeHtml(formatPesoSafe(absAmount))}</td>
        <td class="num">${escapeHtml(formatPesoSafe(t.balanceAfter ?? 0))}</td>
        <td>${escapeHtml(t.status || "completed")}</td>
        <td>
          ${t?.note ? `<div style="font-size:10px; color:#64748b;">"${escapeHtml(t.note)}"</div>` : ""}
          ${t?.metadata?.bookingId ? `<div style="font-size:10px; color:#64748b;">Booking: ${escapeHtml(String(t.metadata.bookingId).slice(0, 8))}…</div>` : ""}
          ${!t?.note && !t?.metadata?.bookingId ? "—" : ""}
        </td>
      </tr>`);
    }

    html.push(`</tbody>
    <tfoot>
      <tr style="background: var(--thead); font-weight: 600;">
        <td colspan="4" style="text-align: right; padding: 12px;">Total:</td>
        <td class="num" style="padding: 12px; color: var(--ink);">${formatPesoSafe(totalCredits - totalDebits)}</td>
        <td colspan="3"></td>
      </tr>
      <tr style="background: var(--subtle);">
        <td colspan="4" style="text-align: right; padding: 8px 12px; font-size: 11px; color: var(--muted);">Total Credits:</td>
        <td class="num credit" style="padding: 8px 12px; font-size: 11px;">${formatPesoSafe(totalCredits)}</td>
        <td colspan="3"></td>
      </tr>
      <tr style="background: var(--subtle);">
        <td colspan="4" style="text-align: right; padding: 8px 12px; font-size: 11px; color: var(--muted);">Total Debits:</td>
        <td class="num debit" style="padding: 8px 12px; font-size: 11px;">${formatPesoSafe(totalDebits)}</td>
        <td colspan="3"></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div>Bookify • Wallet Transactions export</div>
    <div>Page <span class="page-num"></span></div>
  </div>

</body>
</html>`);

    return html.join("");
  };

  // export PDF via preview
  const exportPDF = () => {
    try {
      const htmlContent = generatePDFHTML();
      const timeFilterSuffix = timeFilter !== "all" ? `_${timeFilter}` : "";
      const filename = `wallet_transactions_${new Date().toISOString().slice(0, 10)}${timeFilterSuffix}.pdf`;
      setPdfPreview({ open: true, htmlContent, filename });
    } catch (e) {
      console.error("Failed to generate PDF preview", e);
      alert("Failed to generate PDF preview: " + String(e));
    }
  };

  // Download PDF from preview
  const handleDownloadPDF = async () => {
    try {
      const htmlContent = generatePDFHTML();
      const filename = pdfPreview.filename || `wallet_transactions_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Load html2pdf library dynamically
      const loadHtml2Pdf = () => {
        return new Promise((resolve, reject) => {
          if (window.html2pdf) {
            resolve(window.html2pdf);
            return;
          }
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          script.onload = () => resolve(window.html2pdf);
          script.onerror = () => reject(new Error("Failed to load html2pdf library"));
          document.head.appendChild(script);
        });
      };

      const html2pdf = await loadHtml2Pdf();
      const element = document.createElement("div");
      element.innerHTML = htmlContent;
      document.body.appendChild(element);

      const opt = {
        margin: [18, 18],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
      setPdfPreview({ open: false, htmlContent: "", filename: "" });
    } catch (err) {
      // Fallback to print dialog if library fails
      const win = window.open("", "_blank");
      if (!win) {
        alert("Unable to open print window. Please allow popups for this site.");
        return;
      }
      win.document.open();
      win.document.write(generatePDFHTML());
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
      setPdfPreview({ open: false, htmlContent: "", filename: "" });
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
      "bookingId",
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
    const timeFilterSuffix = timeFilter !== "all" ? `_${timeFilter}` : "";
    a.download = `admin-wallet-transactions_${new Date().toISOString().slice(0, 10)}${timeFilterSuffix}.csv`;
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

  // Handle confirm button click - add amount to admin wallet
  const handleConfirmTransaction = async (tx) => {
    if (!tx || confirmingTx) return;
    
    const amount = Math.abs(tx.delta || 0);
    if (amount <= 0) {
      alert("Invalid transaction amount.");
      return;
    }

    setConfirmingTx(tx.id);
    try {
      await runTransaction(database, async (transaction) => {
        // Read current admin wallet balance
        const walletRef = doc(database, "wallets", ADMIN_WALLET_ID);
        const walletSnap = await transaction.get(walletRef);
        const currentBalance = Number(walletSnap.data()?.balance || 0);
        const newBalance = currentBalance + amount;

        // Create a new transaction record for the confirmed payment
        const transactionRef = doc(collection(database, "wallets", ADMIN_WALLET_ID, "transactions"));
        transaction.set(transactionRef, {
          uid: ADMIN_WALLET_ID,
          type: tx.type || "payment_confirmed",
          delta: +amount,
          amount: amount,
          status: "completed",
          method: tx.method || "manual",
          note: `Confirmed payment${tx.note ? `: ${tx.note}` : ""}`,
          balanceAfter: newBalance,
          metadata: {
            ...(tx.metadata || {}),
            confirmedFrom: tx.id,
            confirmedAt: serverTimestamp(),
          },
          timestamp: serverTimestamp(),
        });

        // Update admin wallet balance
        transaction.set(
          walletRef,
          {
            uid: ADMIN_WALLET_ID,
            balance: newBalance,
            currency: "PHP",
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      // Mark transaction as confirmed and save to localStorage
      setConfirmedTxIds((prev) => {
        const newSet = new Set([...prev, tx.id]);
        // Save to localStorage
        try {
          localStorage.setItem("adminWalletConfirmedTxIds", JSON.stringify(Array.from(newSet)));
        } catch (e) {
          console.error("Failed to save confirmed transaction IDs to localStorage:", e);
        }
        return newSet;
      });

      // Show success message
      const toast = document.createElement("div");
      toast.className = "fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm shadow border bg-emerald-50 text-emerald-700 border-emerald-200";
      toast.textContent = `Successfully added ${peso(amount)} to admin wallet.`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (error) {
      console.error("Confirm transaction error:", error);
      alert(`Failed to confirm transaction: ${error?.message || "Unknown error"}`);
    } finally {
      setConfirmingTx(null);
    }
  };

  /* ======================= Render ======================= */
  const balanceCard = (
    <div className="rounded-3xl border border-white/40 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 backdrop-blur-sm shadow-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 grid place-items-center text-white shadow">
            <WalletIcon size={18} />
          </div>
          <div>
            <div className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Admin Wallet Balance</div>
            <div className="text-3xl sm:text-4xl font-bold text-slate-900">
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
            <span className="font-semibold text-sm sm:text-base">Export CSV</span>
          </button>
          <button
            onClick={exportPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-10 shadow-sm transition bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-600"
          >
            <FileDown size={16} />
            <span className="font-semibold text-sm sm:text-base">Export PDF</span>
          </button>
          <button
            onClick={printTable}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl min-h-10 shadow-sm transition bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-600"
          >
            <Printer size={16} />
            <span className="font-semibold text-sm sm:text-base">Print</span>
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
        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-3 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">
            {/* Balance + actions */}
            {balanceCard}

            {/* Search and Filters */}
            <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 space-y-4">
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
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition ${
                    hasActiveFilters
                      ? "bg-blue-50 border-blue-300 text-blue-700"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={16} />
                  <span className="font-medium text-sm">Filters</span>
                  {hasActiveFilters && (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                      {[paymentMethodFilter !== "all", categoryFilter !== "all", userTypeFilter !== "all", dateRange.start, dateRange.end].filter(Boolean).length}
                    </span>
                  )}
                </button>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
                <div className="hidden sm:block text-xs text-slate-500 whitespace-nowrap">
                  Showing {filtered.length} of {allTxs.length}
                </div>
              </div>
              
              {/* Filter Panel */}
              {showFilters && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Payment Method Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethodFilter}
                        onChange={(e) => setPaymentMethodFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Methods</option>
                        {uniqueMethods.map((method) => (
                          <option key={method} value={method}>
                            {method.charAt(0).toUpperCase() + method.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Category/Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Category/Type
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Categories</option>
                        {uniqueCategories.map((category) => (
                          <option key={category} value={category}>
                            {category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* User Type Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        User Type
                      </label>
                      <select
                        value={userTypeFilter}
                        onChange={(e) => setUserTypeFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Users</option>
                        <option value="guest">Guest</option>
                        <option value="host">Host</option>
                      </select>
                    </div>
                    
                    {/* Time Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Time Period
                      </label>
                      <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="year">This Year</option>
                      </select>
                    </div>
                    
                    {/* Date Range Filter */}
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                        Date Range
                      </label>
                      <DateRangeFilter
                        value={dateRange}
                        onChange={setDateRange}
                        placeholder="Select date range"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Transactions */}
            <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-lg text-slate-900">Payments & Methods</h4>
                {txLoading && (
                  <span className="inline-flex items-center gap-1 text-base text-slate-600">
                    <Loader2 size={16} className="animate-spin" /> Loading…
                  </span>
                )}
              </div>

              {txError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm inline-flex items-center gap-2">
                  <AlertCircle size={16} /> {txError}
                </div>
              ) : paginatedFiltered.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b-2 border-slate-300">
                        <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Type</th>
                        <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Date</th>
                        <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Method</th>
                        <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Host Name</th>
                        <th className="text-right py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Amount</th>
                        <th className="text-right py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Balance</th>
                        <th className="text-center py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Status</th>
                        <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Details</th>
                        <th className="text-center py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedFiltered.map((t) => {
                        const sign = t.delta >= 0 ? "+" : "–";
                        const absAmount = Math.abs(t.delta);
                        const isCredit = t.delta >= 0;
                        const iconBg = isCredit ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700";
                        const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
                        const statusKind =
                          t.status === "completed" ? "success" : t.status === "pending" ? "warning" : "danger";
                        
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg grid place-items-center ${iconBg} shrink-0`}>
                                  <Icon size={18} />
                                </div>
                                <span className="font-semibold text-slate-900 text-sm sm:text-base">
                                  {t.type?.replace(/_/g, " ") || "Transaction"}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-sm sm:text-base text-slate-700 whitespace-nowrap font-medium">
                              {formatDate(t.timestamp)}
                            </td>
                            <td className="py-4 px-4">
                              {t.method ? (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                  {t.method}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-sm sm:text-base text-slate-700 font-medium">
                              {t?.metadata?.hostUid ? (
                                hostNames.get(t.metadata.hostUid) || (
                                  <span className="text-slate-400 italic">Loading...</span>
                                )
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className={`py-4 px-4 text-right text-sm sm:text-base font-bold whitespace-nowrap ${isCredit ? "text-emerald-700" : "text-rose-700"}`}>
                              {sign}{peso(absAmount)}
                            </td>
                            <td className="py-4 px-4 text-right text-sm sm:text-base text-slate-700 whitespace-nowrap font-medium">
                              {peso(t.balanceAfter ?? 0)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <Badge kind={statusKind}>{t.status || "completed"}</Badge>
                            </td>
                            <td className="py-4 px-4 text-sm sm:text-base text-slate-700">
                              <div className="space-y-1">
                                {t?.note && (
                                  <div className="text-sm">"{t.note}"</div>
                                )}
                                {t?.metadata?.bookingId && (
                                  <div className="text-sm">Booking: {t.metadata.bookingId.slice(0, 8)}…</div>
                                )}
                                {!t?.note && !t?.metadata?.bookingId && (
                                  <span className="text-slate-400">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {confirmedTxIds.has(t.id) ? (
                                <button
                                  disabled
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-400 cursor-not-allowed"
                                >
                                  <CheckCircle2 size={14} />
                                  Confirmed
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleConfirmTransaction(t)}
                                  disabled={confirmingTx === t.id || confirmingTx !== null}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                                    confirmingTx === t.id
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow"
                                  }`}
                                >
                                  {confirmingTx === t.id ? (
                                    <>
                                      <Loader2 size={14} className="animate-spin" />
                                      Confirming...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 size={14} />
                                      Confirm
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    {hasActiveFilters || filter ? (
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
                    {hasActiveFilters || filter ? (
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
      </div>
      
      {/* PDF Preview Modal */}
      {pdfPreview && (
        <PDFPreviewModal
          open={pdfPreview.open}
          htmlContent={pdfPreview.htmlContent}
          filename={pdfPreview.filename}
          onClose={() => setPdfPreview({ open: false, htmlContent: "", filename: "" })}
          onDownload={handleDownloadPDF}
        />
      )}
    </div>
  );
}

