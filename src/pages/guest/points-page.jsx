// src/pages/guest/points-page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Gift,
  ShoppingBag,
  Wallet,
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
import BookifyLogo from "../../components/bookify-logo.jsx";

/* ======================= Helpers ======================= */
const formatDate = (ts) => {
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    if (typeof ts === "string" || typeof ts === "number") return new Date(ts).toLocaleString();
  } catch {}
  return "—";
};

const formatPoints = (pts) => {
  const n = Number(pts ?? 0);
  return `${n.toLocaleString("en-US")} pts`;
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

/* ======================= Main Page ======================= */
export default function PointsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [uid, setUid] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [points, setPoints] = useState({ balance: 0 });

  // Transactions state
  const [allTxs, setAllTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState(null);
  const [lastCursor, setLastCursor] = useState(null);
  const [endReached, setEndReached] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all, earned, withdrawn, used

  const PAGE_SIZE = 20;

  // Auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUid(u?.uid || null);
    });
    return () => unsub();
  }, []);

  // Load points balance
  useEffect(() => {
    if (!uid) return;
    const pref = doc(database, "points", uid);

    const unsub = onSnapshot(pref, (s) => {
      const d = s.data() || { balance: 0 };
      setPoints({ balance: Number(d.balance || 0) });
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
      const tRef = collection(database, "points", uid, "transactions");
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
          const tRef = collection(database, "points", uid, "transactions");
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

  // Filtered view (by type and search)
  const filtered = useMemo(() => {
    let result = allTxs;
    
    // Filter by type
    if (typeFilter !== "all") {
      if (typeFilter === "earned") {
        result = result.filter((t) => {
          const type = (t.type || "").toLowerCase();
          return type.includes("reward") || type.includes("bonus") || type.includes("signup");
        });
      } else if (typeFilter === "withdrawn") {
        result = result.filter((t) => {
          const type = (t.type || "").toLowerCase();
          return type.includes("redeem") || type.includes("withdraw");
        });
      } else if (typeFilter === "used") {
        result = result.filter((t) => {
          const type = (t.type || "").toLowerCase();
          return type.includes("used") || type.includes("spent");
        });
      }
    }
    
    // Filter by search
    const f = (filter || "").trim().toLowerCase();
    if (f) {
      result = result.filter((t) => {
        const hay = `${t.type || ""} ${t.note || ""} ${t.bookingId || ""}`.toLowerCase();
        return hay.includes(f);
      });
    }
    
    return result;
  }, [allTxs, filter, typeFilter]);

  // Pagination for filtered results
  const filteredTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const filteredStartIdx = (currentPage - 1) * PAGE_SIZE;
  const filteredEndIdx = filteredStartIdx + PAGE_SIZE;
  const paginatedFiltered = filtered.slice(filteredStartIdx, filteredEndIdx);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter]);

  // Get transaction type label and icon
  const getTransactionInfo = (tx) => {
    const type = (tx.type || "").toLowerCase();
    const delta = Number(tx.delta || 0);
    const isPositive = delta > 0;
    
    if (type.includes("reward") || type.includes("bonus") || type.includes("signup")) {
      return {
        label: type.includes("signup") ? "Signup Bonus" : type.includes("booking") ? "Booking Reward" : "Reward",
        icon: Gift,
        kind: "success",
        isPositive: true,
      };
    } else if (type.includes("redeem") || type.includes("withdraw")) {
      return {
        label: "Withdrawn",
        icon: Wallet,
        kind: "warning",
        isPositive: false,
      };
    } else if (type.includes("used") || type.includes("spent")) {
      return {
        label: "Used",
        icon: ShoppingBag,
        kind: "danger",
        isPositive: false,
      };
    }
    
    return {
      label: tx.type || "Transaction",
      icon: isPositive ? ArrowUpRight : ArrowDownLeft,
      kind: isPositive ? "success" : "danger",
      isPositive,
    };
  };

  if (!uid) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="inline-flex items-center gap-2 text-slate-600 text-sm">
          <Loader2 className="animate-spin" size={16} /> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      {/* ===== Sidebar ===== */}
      <Sidebar />

      {/* ===== Top Navbar ===== */}
      <header
        className={`
          fixed top-0 right-0 z-30
          bg-white text-gray-800 border-b border-gray-200 shadow-sm
          transition-all duration-300
          left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}
        `}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open menu"
              aria-controls="app-sidebar"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden rounded-lg bg-white border border-gray-200 p-2 shadow-sm ${
                sidebarOpen ? "hidden" : ""
              }`}
            >
              <Menu size={20} />
            </button>

            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/dashboard")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">Points</span>
            </div>
          </div>
        </div>
      </header>

      {/* Spacer under fixed header */}
      <div className="h-[56px] md:h-[56px]" />

      {/* ===== Main Content ===== */}
      <main
        className={`
          transition-[margin] duration-300 ml-0
          ${sidebarOpen ? "md:ml-72" : "md:ml-20"}
          px-4 sm:px-6 lg:px-12 py-6
        `}
      >
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Points</h1>
            <p className="text-muted-foreground">View your points balance and transaction history.</p>
          </div>

          {/* Points Balance Card */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 font-medium">Total Points</p>
                {loadingWallet ? (
                  <Line w="120px" className="mt-2" />
                ) : (
                  <p className="text-4xl font-bold text-slate-900 mt-1">
                    {formatPoints(points.balance)}
                  </p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Type Filter */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTypeFilter("all")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    typeFilter === "all"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setTypeFilter("earned")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    typeFilter === "earned"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Gift size={14} className="inline mr-1" />
                  Earned
                </button>
                <button
                  onClick={() => setTypeFilter("withdrawn")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    typeFilter === "withdrawn"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Wallet size={14} className="inline mr-1" />
                  Withdrawn
                </button>
                <button
                  onClick={() => setTypeFilter("used")}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    typeFilter === "used"
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white/80 text-slate-700 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <ShoppingBag size={14} className="inline mr-1" />
                  Used
                </button>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 bg-white focus:ring-4 focus:ring-blue-100 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Transaction History</h2>
              
              {txLoading && allTxs.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Line key={i} />
                  ))}
                </div>
              ) : txError ? (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto text-rose-500 mb-2" size={32} />
                  <p className="text-sm text-slate-600">{txError}</p>
                </div>
              ) : paginatedFiltered.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-sm text-slate-600">
                    {filter || typeFilter !== "all"
                      ? "No transactions match your filters."
                      : "No transactions yet."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {paginatedFiltered.map((tx) => {
                      const info = getTransactionInfo(tx);
                      const Icon = info.icon;
                      const delta = Number(tx.delta || 0);
                      const amount = Number(tx.amount || Math.abs(delta));
                      
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white/50 hover:bg-white transition"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={`p-2 rounded-lg ${
                              info.isPositive ? "bg-emerald-100" : "bg-rose-100"
                            }`}>
                              <Icon
                                size={20}
                                className={info.isPositive ? "text-emerald-600" : "text-rose-600"}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-slate-900">{info.label}</p>
                                <Badge kind={info.kind}>{tx.status || "completed"}</Badge>
                              </div>
                              {tx.note && (
                                <p className="text-sm text-slate-600 mt-1 truncate">{tx.note}</p>
                              )}
                              <p className="text-xs text-slate-500 mt-1">
                                {formatDate(tx.timestamp)}
                                {tx.bookingId && ` • Booking: ${tx.bookingId.slice(0, 8)}...`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p
                              className={`text-lg font-bold ${
                                info.isPositive ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {info.isPositive ? "+" : "-"}
                              {formatPoints(amount)}
                            </p>
                            {tx.balanceAfter !== undefined && (
                              <p className="text-xs text-slate-500 mt-1">
                                Balance: {formatPoints(tx.balanceAfter)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {filteredTotalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => goToPage(1)}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronsLeft size={16} />
                        </button>
                        <button
                          onClick={prevPage}
                          disabled={currentPage === 1}
                          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft size={16} />
                        </button>
                      </div>
                      
                      <span className="text-sm text-slate-600">
                        Page {currentPage} of {filteredTotalPages}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={nextPage}
                          disabled={currentPage === filteredTotalPages || (endReached && filtered.length <= currentPage * PAGE_SIZE)}
                          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={() => goToPage(filteredTotalPages)}
                          disabled={currentPage === filteredTotalPages}
                          className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronsRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Load More */}
                  {!endReached && !txLoading && (
                    <div className="text-center mt-4">
                      <button
                        onClick={loadMoreTxs}
                        disabled={txLoading}
                        className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium disabled:opacity-50"
                      >
                        {txLoading ? (
                          <>
                            <Loader2 className="inline animate-spin mr-2" size={16} />
                            Loading...
                          </>
                        ) : (
                          "Load More"
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

