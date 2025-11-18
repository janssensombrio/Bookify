// src/pages/guest/points-page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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
  Star,
  Percent,
  Tag,
  Check,
  Coins,
  X,
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
  addDoc,
  updateDoc,
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

const peso = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString(undefined, { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 50 pts = 1 peso -> 1 pt = ₱0.02
const ptsToPHP = (pts) => Number((Number(pts || 0) * 0.02).toFixed(2));

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

  // Rewards state
  const [availableRewards, setAvailableRewards] = useState([]);
  const [redeemedRewards, setRedeemedRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [redeeming, setRedeeming] = useState(null); // reward ID being redeemed

  // Withdraw modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawingPts, setWithdrawingPts] = useState(false);

  // Redeemed rewards modal state
  const [showRedeemedModal, setShowRedeemedModal] = useState(false);
  
  // Success modal state
  const [successModal, setSuccessModal] = useState({ open: false, message: "" });

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

  // Load available rewards
  useEffect(() => {
    const loadRewards = async () => {
      try {
        setLoadingRewards(true);
        const rewardsRef = collection(database, "rewards");
        
        // Try query with orderBy first (requires composite index)
        try {
          const q = query(rewardsRef, where("active", "==", true), orderBy("pointsCost", "asc"));
          const snap = await getDocs(q);
          const rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAvailableRewards(rewards);
        } catch (indexError) {
          // If composite index error, try without orderBy
          if (indexError?.code === "failed-precondition" || indexError?.message?.includes("index")) {
            console.warn("Composite index not found, loading rewards without sorting:", indexError);
            const q = query(rewardsRef, where("active", "==", true));
            const snap = await getDocs(q);
            const rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort manually
            rewards.sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));
            setAvailableRewards(rewards);
          } else {
            // Other error - try loading all and filtering client-side
            console.warn("Error loading rewards, trying fallback:", indexError);
            const snap = await getDocs(rewardsRef);
            const rewards = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((r) => r.active === true)
              .sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));
            setAvailableRewards(rewards);
          }
        }
      } catch (e) {
        console.error("Failed to load rewards:", e);
        // Show error to user
        alert(`Failed to load rewards: ${e?.message || "Unknown error"}`);
      } finally {
        setLoadingRewards(false);
      }
    };
    loadRewards();
  }, []);

  // Load redeemed rewards for current user
  useEffect(() => {
    if (!uid) return;
    const redeemedRef = collection(database, "users", uid, "redeemedRewards");
    
    // Load ALL redeemed rewards (including used ones) so button shows
    // Try with orderBy first, fallback to without if index doesn't exist
    let unsub;
    const loadRewards = async () => {
      try {
        const q = query(redeemedRef, orderBy("redeemedAt", "desc"));
        unsub = onSnapshot(
          q,
          (snap) => {
            const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRedeemedRewards(redeemed);
          },
          (err) => {
            console.error("Failed to load redeemed rewards with orderBy:", err);
            // Fallback: load without orderBy
            const qFallback = query(redeemedRef);
            onSnapshot(
              qFallback,
              (snap) => {
                const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                // Sort client-side by redeemedAt
                redeemed.sort((a, b) => {
                  const aTime = a.redeemedAt?.toDate?.() || new Date(0);
                  const bTime = b.redeemedAt?.toDate?.() || new Date(0);
                  return bTime - aTime;
                });
                setRedeemedRewards(redeemed);
              },
              (err2) => {
                console.error("Failed to load redeemed rewards:", err2);
                setRedeemedRewards([]);
              }
            );
          }
        );
      } catch (err) {
        // If query construction fails, load without orderBy
        const qFallback = query(redeemedRef);
        unsub = onSnapshot(
          qFallback,
          (snap) => {
            const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort client-side by redeemedAt
            redeemed.sort((a, b) => {
              const aTime = a.redeemedAt?.toDate?.() || new Date(0);
              const bTime = b.redeemedAt?.toDate?.() || new Date(0);
              return bTime - aTime;
            });
            setRedeemedRewards(redeemed);
          },
          (err2) => {
            console.error("Failed to load redeemed rewards:", err2);
            setRedeemedRewards([]);
          }
        );
      }
    };
    
    loadRewards();
    return () => {
      if (unsub) unsub();
    };
  }, [uid]);

  // Redeem reward function
  const handleRedeemReward = async (reward) => {
    if (!uid || redeeming) return;
    if (points.balance < reward.pointsCost) {
      alert(`You need ${reward.pointsCost} points to redeem this reward. You currently have ${points.balance} points.`);
      return;
    }

    setRedeeming(reward.id);
    try {
      await runTransaction(database, async (tx) => {
        const pointsRef = doc(database, "points", uid);
        const ptsLogRef = doc(collection(database, "points", uid, "transactions"));
        const redeemedRef = doc(collection(database, "users", uid, "redeemedRewards"));

        // Read current points
        const ptsSnap = await tx.get(pointsRef);
        const currentBalance = Number(ptsSnap.data()?.balance || 0);

        if (currentBalance < reward.pointsCost) {
          throw new Error("Insufficient points");
        }

        const newBalance = currentBalance - reward.pointsCost;

        // Deduct points
        tx.set(
          pointsRef,
          { uid, balance: newBalance, updatedAt: serverTimestamp() },
          { merge: true }
        );

        // Log transaction
        tx.set(ptsLogRef, {
          uid,
          type: "reward_redeemed",
          delta: -reward.pointsCost,
          amount: reward.pointsCost,
          status: "completed",
          note: `Redeemed: ${reward.name}`,
          rewardId: reward.id,
          balanceAfter: newBalance,
          timestamp: serverTimestamp(),
        });

        // Create redeemed reward
        const redeemedRewardData = {
          uid: uid, // Required by Firestore security rules
          rewardId: reward.id,
          rewardName: reward.name,
          discountType: reward.discountType || "percentage",
          discountValue: reward.discountValue || 0,
          pointsCost: reward.pointsCost,
          used: false,
          redeemedAt: serverTimestamp(),
        };
        
        // Only add optional fields if they exist
        if (reward.type) redeemedRewardData.rewardType = reward.type;
        if (reward.value !== undefined) redeemedRewardData.rewardValue = reward.value;
        if (reward.expiresInDays) {
          redeemedRewardData.expiresAt = new Date(Date.now() + reward.expiresInDays * 24 * 60 * 60 * 1000);
        }
        
        tx.set(redeemedRef, redeemedRewardData);
      });

      setSuccessModal({
        open: true,
        message: `Successfully redeemed "${reward.name}"! You can use it during booking.`
      });
    } catch (err) {
      console.error("Failed to redeem reward:", err);
      alert(err.message || "Failed to redeem reward. Please try again.");
    } finally {
      setRedeeming(null);
    }
  };

  // Use/claim reward for booking
  const handleUseReward = (redeemedReward) => {
    if (!uid) {
      alert("Please sign in to use rewards.");
      return;
    }
    
    const expiresAt = redeemedReward.expiresAt?.toDate?.() || null;
    const isExpired = expiresAt && expiresAt < new Date();
    
    if (isExpired) {
      alert("This reward has expired and cannot be used.");
      return;
    }
    
    if (redeemedReward.used) {
      alert("This reward has already been used.");
      return;
    }
    
    // Store selected reward in localStorage for use during booking
    const rewardData = {
      id: redeemedReward.id,
      rewardId: redeemedReward.rewardId,
      rewardName: redeemedReward.rewardName,
      discountType: redeemedReward.discountType || "percentage",
      discountValue: redeemedReward.discountValue || redeemedReward.rewardValue,
    };
    localStorage.setItem("selectedReward", JSON.stringify(rewardData));
    
    // Dispatch custom event to notify other pages (like listing page) that reward was selected
    window.dispatchEvent(new CustomEvent("rewardSelected", { detail: rewardData }));
    
    setSuccessModal({
      open: true,
      message: `"${redeemedReward.rewardName}" is now selected for your next booking! The discount will be applied automatically at checkout.`
    });
  };

  // Withdraw points to E-Wallet
  const handleWithdrawPoints = async (pts) => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to withdraw points.");
      return;
    }

    const want = Number(pts || 0) | 0;
    if (want <= 0) return;
    if (want > points.balance) {
      alert("Not enough points.");
      return;
    }

    const php = ptsToPHP(want);

    setWithdrawingPts(true);
    try {
      const pointsRef = doc(database, "points", user.uid);
      const walletRef = doc(database, "guestWallets", user.uid);
      const walletTxRef = doc(collection(database, "guestWallets", user.uid, "transactions"));
      const pointsTxRef = doc(collection(database, "points", user.uid, "transactions"));

      await runTransaction(database, async (tx) => {
        // read points
        const pSnap = await tx.get(pointsRef);
        const curPts = Number(pSnap.data()?.balance || 0);
        if (want > curPts) throw new Error("Not enough points.");
        const newPts = curPts - want;

        // read wallet
        const wSnap = await tx.get(walletRef);
        const curBal = Number(wSnap.data()?.balance || 0);
        const newBal = curBal + php;

        // write points
        tx.set(pointsRef, { uid: user.uid, balance: newPts, updatedAt: serverTimestamp() }, { merge: true });

        // ensure wallet + write
        tx.set(walletRef, { uid: user.uid, balance: newBal, currency: "PHP", updatedAt: serverTimestamp() }, { merge: true });

        // add wallet transaction
        tx.set(walletTxRef, {
          uid: user.uid,
          type: "points_redeem",
          delta: +php,
          amount: php,
          status: "completed",
          method: "rewards",
          note: `Redeemed ${want} pts`,
          balanceAfter: newBal,
          timestamp: serverTimestamp(),
        });

        // add points transaction record
        tx.set(pointsTxRef, {
          uid: user.uid,
          type: "points_redeem",
          delta: -want,
          amount: want,
          status: "completed",
          method: "rewards",
          note: `Redeemed ${want} pts for ₱${php.toFixed(2)}`,
          balanceAfter: newPts,
          timestamp: serverTimestamp(),
        });
      });

      setShowWithdrawModal(false);
      alert(`Successfully withdrew ${want} points (${peso(php)}) to your E-Wallet!`);
    } catch (e) {
      console.error("Withdraw points failed:", e?.message || e);
      alert(e?.message || "Withdraw failed. Please try again.");
    } finally {
      setWithdrawingPts(false);
    }
  };

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
          // Exclude reward_redeemed from withdrawn - those should only show in "used"
          return (type.includes("redeem") || type.includes("withdraw")) && !type.includes("reward_redeemed");
        });
      } else if (typeFilter === "used") {
        result = result.filter((t) => {
          const type = (t.type || "").toLowerCase();
          const delta = Number(t.delta || 0);
          // Include reward_redeemed transactions and other used/spent transactions
          return type.includes("reward_redeemed") ||
                 type.includes("used") || 
                 type.includes("spent") || 
                 (delta < 0 && !type.includes("reward") && !type.includes("bonus") && !type.includes("signup"));
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
          <div className="rounded-3xl border border-white/40 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 backdrop-blur-sm shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 font-medium">Total Points</p>
                  {loadingWallet ? (
                    <Line w="120px" className="mt-2" />
                  ) : (
                    <>
                      <p className="text-4xl font-bold text-slate-900 mt-1">
                        {formatPoints(points.balance)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        ≈ {peso(ptsToPHP(points.balance))} in E-Wallet
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {redeemedRewards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRedeemedModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold shadow-md hover:from-emerald-600 hover:to-emerald-700 transition"
                  >
                    <CheckCircle2 size={16} />
                    Redeemed ({redeemedRewards.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={loadingWallet || points.balance <= 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold shadow-md hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Wallet size={16} />
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Rewards Section */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Gift className="w-6 h-6 text-amber-500" />
              Rewards
            </h2>

            {/* Available Rewards */}
            <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-6 mb-4">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Available Rewards</h3>
              {loadingRewards ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <Line w="60%" className="mb-2" />
                      <Line w="80%" />
                    </div>
                  ))}
                </div>
              ) : availableRewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-sm text-slate-600 mb-2">No rewards available at the moment.</p>
                  <p className="text-xs text-slate-500">
                    {process.env.NODE_ENV === "development" && "Check console for errors or verify rewards are marked as active in admin."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableRewards.map((reward) => {
                    const canAfford = points.balance >= reward.pointsCost;
                    const isRedeeming = redeeming === reward.id;
                    return (
                      <div
                        key={reward.id}
                        className={`rounded-2xl border-2 p-5 transition-all ${
                          canAfford
                            ? "border-blue-200 bg-gradient-to-br from-blue-50 to-white hover:shadow-lg"
                            : "border-slate-200 bg-slate-50 opacity-75"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-900 mb-1">{reward.name}</h4>
                            <p className="text-sm text-slate-600 mb-2">{reward.description}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {reward.discountType === "percentage" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                  <Percent size={12} />
                                  {reward.discountValue || reward.value}% OFF
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                  <Tag size={12} />
                                  ₱{Number(reward.discountValue || reward.value).toLocaleString()} OFF
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="p-2 rounded-xl bg-amber-100">
                            <Star className="w-5 h-5 text-amber-600" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                          <div>
                            <p className="text-xs text-slate-500">Cost</p>
                            <p className="text-lg font-bold text-slate-900">
                              {formatPoints(reward.pointsCost)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRedeemReward(reward)}
                            disabled={!canAfford || isRedeeming}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                              canAfford && !isRedeeming
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md"
                                : "bg-slate-200 text-slate-500 cursor-not-allowed"
                            }`}
                          >
                            {isRedeeming ? (
                              <>
                                <Loader2 className="inline animate-spin mr-1" size={14} />
                                Redeeming...
                              </>
                            ) : canAfford ? (
                              "Redeem"
                            ) : (
                              "Insufficient Points"
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
                  {filtered.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* Page Info */}
                        <div className="text-sm text-slate-600">
                          Showing {filteredStartIdx + 1} to {Math.min(filteredEndIdx, filtered.length)} of {filtered.length} transactions
                        </div>
                        
                        {/* Pagination Controls */}
                        {filteredTotalPages > 1 && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => goToPage(1)}
                              disabled={currentPage === 1}
                              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              title="First page"
                            >
                              <ChevronsLeft size={16} />
                            </button>
                            <button
                              onClick={prevPage}
                              disabled={currentPage === 1}
                              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              title="Previous page"
                            >
                              <ChevronLeft size={16} />
                            </button>
                            
                            {/* Page Number Buttons */}
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(5, filteredTotalPages) }, (_, i) => {
                                let pageNum;
                                if (filteredTotalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (currentPage >= filteredTotalPages - 2) {
                                  pageNum = filteredTotalPages - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => goToPage(pageNum)}
                                    className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                      currentPage === pageNum
                                        ? "bg-blue-600 text-white shadow-md"
                                        : "border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              })}
                            </div>
                            
                            <button
                              onClick={nextPage}
                              disabled={currentPage === filteredTotalPages || (endReached && filtered.length <= currentPage * PAGE_SIZE)}
                              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              title="Next page"
                            >
                              <ChevronRight size={16} />
                            </button>
                            <button
                              onClick={() => goToPage(filteredTotalPages)}
                              disabled={currentPage === filteredTotalPages}
                              className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                              title="Last page"
                            >
                              <ChevronsRight size={16} />
                            </button>
                          </div>
                        )}
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

      {/* Withdraw Points Modal */}
      <PointsWithdrawModal
        open={showWithdrawModal}
        onClose={() => !withdrawingPts && setShowWithdrawModal(false)}
        points={points.balance}
        onWithdraw={handleWithdrawPoints}
        busy={withdrawingPts}
      />

      {/* Redeemed Rewards Modal */}
      <RedeemedRewardsModal
        open={showRedeemedModal}
        onClose={() => setShowRedeemedModal(false)}
        redeemedRewards={redeemedRewards}
        onUseReward={handleUseReward}
      />

      {/* Success Modal */}
      <SuccessModal
        open={successModal.open}
        message={successModal.message}
        onClose={() => setSuccessModal({ open: false, message: "" })}
      />
    </div>
  );
}

/* ======================= Redeemed Rewards Modal ======================= */
function RedeemedRewardsModal({ open, onClose, redeemedRewards = [], onUseReward }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 grid place-items-center text-white shadow">
              <CheckCircle2 size={18} />
            </div>
            <h3 className="text-lg font-semibold">My Redeemed Rewards ({redeemedRewards.length})</h3>
          </div>
          <button className="p-1 rounded hover:bg-slate-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {redeemedRewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-sm text-slate-600">No redeemed rewards yet.</p>
              <p className="text-xs text-slate-500 mt-1">Redeem rewards from the available rewards section above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {redeemedRewards.map((redeemed) => {
                const expiresAt = redeemed.expiresAt?.toDate?.() || null;
                const isExpired = expiresAt && expiresAt < new Date();
                const isUsed = redeemed.used === true;
                const canUse = !isExpired && !isUsed;
                
                // Check if this reward is currently selected
                const selectedRewardStr = localStorage.getItem("selectedReward");
                const selectedReward = selectedRewardStr ? JSON.parse(selectedRewardStr) : null;
                const isSelected = selectedReward && selectedReward.id === redeemed.id;
                
                return (
                  <div
                    key={redeemed.id}
                    className={`rounded-2xl border-2 p-4 transition-all ${
                      isExpired
                        ? "border-rose-200 bg-rose-50"
                        : isUsed
                        ? "border-slate-200 bg-slate-50 opacity-75"
                        : isSelected
                        ? "border-blue-400 bg-gradient-to-br from-blue-50 to-white ring-2 ring-blue-300"
                        : "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 mb-1">{redeemed.rewardName}</h4>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {redeemed.discountType === "percentage" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                              <Percent size={10} />
                              {redeemed.discountValue}% OFF
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                              <Tag size={10} />
                              ₱{Number(redeemed.discountValue).toLocaleString()} OFF
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                              Expired
                            </span>
                          )}
                          {isUsed && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                              Used
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              Selected
                            </span>
                          )}
                        </div>
                        {expiresAt && !isExpired && (
                          <p className="text-xs text-slate-500">
                            Expires: {expiresAt.toLocaleDateString()}
                          </p>
                        )}
                        {redeemed.redeemedAt && (
                          <p className="text-xs text-slate-500 mt-1">
                            Redeemed: {formatDate(redeemed.redeemedAt)}
                          </p>
                        )}
                      </div>
                      {canUse ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Check className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    {canUse ? (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            onUseReward(redeemed);
                            onClose();
                          }}
                          className={`w-full px-4 py-2 rounded-xl text-sm font-semibold transition ${
                            isSelected
                              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                              : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-md"
                          }`}
                        >
                          {isSelected ? "✓ Selected for Booking" : "Use for Booking"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600 mt-2">
                        {isExpired
                          ? "This reward has expired."
                          : isUsed
                          ? "This reward has been used."
                          : "Use this reward during booking to apply the discount."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================= Points Withdraw Modal ======================= */
function PointsWithdrawModal({ open, onClose, points = 0, onWithdraw, busy }) {
  const [value, setValue] = useState("");

  const maxPts = Math.max(0, Number(points || 0) | 0);
  const pts = Number(value || 0) | 0;
  const php = ptsToPHP(pts);
  const can = pts > 0 && pts <= maxPts && !busy;

  // Reset value when modal closes
  useEffect(() => {
    if (!open) {
      setValue("");
    }
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 grid place-items-center text-white shadow">
              <Coins size={18} />
            </div>
            <h3 className="text-lg font-semibold">Withdraw Points</h3>
          </div>
          <button className="p-1 rounded hover:bg-slate-100" onClick={busy ? undefined : onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="text-sm text-slate-600">Available points</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {maxPts.toLocaleString()} pts{" "}
              <span className="text-base font-medium text-slate-500">({peso(ptsToPHP(maxPts))})</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">Rate: 50 pts = ₱1.00</div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-700">Withdraw points</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                placeholder="0"
                disabled={busy}
              />
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm disabled:opacity-50"
                onClick={() => setValue(String(maxPts))}
                disabled={busy || maxPts === 0}
              >
                Max
              </button>
            </div>
          </label>

          <div className="text-sm text-slate-600">
            You'll receive: <span className="font-semibold text-slate-900">{peso(php)}</span> in your E-Wallet.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => onWithdraw(pts)}
              disabled={!can}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow disabled:opacity-60 text-sm"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
              {busy ? "Processing…" : "Withdraw to E-Wallet"}
            </button>
          </div>

          <div className="text-xs text-slate-500">
            This converts points to pesos and creates a wallet transaction labeled <em>points_redeem</em>.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Success Modal ======================= */
function SuccessModal({ open, message, onClose }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Success!</h3>
            {message && (
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{message}</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

