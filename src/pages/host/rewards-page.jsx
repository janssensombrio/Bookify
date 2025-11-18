// src/pages/host/rewards-page.jsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Gift,
  Wallet,
  Percent,
  Tag,
  Check,
  Coins,
  X,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  limit,
} from "firebase/firestore";
import { auth, database } from "../../config/firebase";

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
export default function HostRewardsPage() {
  const [uid, setUid] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [points, setPoints] = useState({ balance: 0 });

  // Rewards state
  const [availableRewards, setAvailableRewards] = useState([]);
  const [redeemedRewards, setRedeemedRewards] = useState([]);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [redeeming, setRedeeming] = useState(null); // reward ID being redeemed

  // Wallet transactions state (for rewards page)
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loadingWalletTxs, setLoadingWalletTxs] = useState(true);

  // Redeemed rewards modal state
  const [showRedeemedModal, setShowRedeemedModal] = useState(false);
  
  // Success modal state
  const [successModal, setSuccessModal] = useState({ open: false, message: "" });

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

  // Load available host rewards
  useEffect(() => {
    const loadRewards = async () => {
      try {
        setLoadingRewards(true);
        const rewardsRef = collection(database, "rewards");
        
        // Try query with orderBy first (requires composite index)
        try {
          const q = query(
            rewardsRef, 
            where("active", "==", true),
            where("userType", "==", "host"),
            orderBy("pointsCost", "asc")
          );
          const snap = await getDocs(q);
          const rewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAvailableRewards(rewards);
        } catch (indexError) {
          // If composite index error, try without orderBy
          if (indexError?.code === "failed-precondition" || indexError?.message?.includes("index")) {
            console.warn("Composite index not found, loading rewards without sorting:", indexError);
            const q = query(
              rewardsRef, 
              where("active", "==", true),
              where("userType", "==", "host")
            );
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
              .filter((r) => r.active === true && r.userType === "host")
              .sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));
            setAvailableRewards(rewards);
          }
        }
      } catch (err) {
        console.error("Failed to load rewards:", err);
        setAvailableRewards([]);
      } finally {
        setLoadingRewards(false);
      }
    };

    loadRewards();
  }, []);

  // Load redeemed rewards for current host
  useEffect(() => {
    if (!uid) return;
    const loadRedeemed = async () => {
      try {
        const redeemedRef = collection(database, "hosts", uid, "redeemedRewards");
        
        // Try ordered query first
        try {
          const q = query(redeemedRef, orderBy("redeemedAt", "desc"));
          const snap = await getDocs(q);
          const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRedeemedRewards(redeemed);
        } catch (err) {
          console.error("Failed to load redeemed rewards with orderBy:", err);
          // Fallback: load all and sort client-side
          try {
            const snap = await getDocs(redeemedRef);
            const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            redeemed.sort((a, b) => {
              const aTime = a.redeemedAt?.toDate?.()?.getTime?.() || 0;
              const bTime = b.redeemedAt?.toDate?.()?.getTime?.() || 0;
              return bTime - aTime;
            });
            setRedeemedRewards(redeemed);
          } catch (err2) {
            console.error("Failed to load redeemed rewards:", err2);
            setRedeemedRewards([]);
          }
        }
      } catch (err) {
        console.error("Failed to load redeemed rewards:", err);
        setRedeemedRewards([]);
      }
    };

    loadRedeemed();

    // Subscribe to real-time updates
    try {
      const redeemedRef = collection(database, "hosts", uid, "redeemedRewards");
      const q = query(redeemedRef, orderBy("redeemedAt", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRedeemedRewards(redeemed);
      }, (err) => {
        // Fallback if orderBy fails
        const fallbackRef = collection(database, "hosts", uid, "redeemedRewards");
        onSnapshot(fallbackRef, (snap) => {
          const redeemed = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          redeemed.sort((a, b) => {
            const aTime = a.redeemedAt?.toDate?.()?.getTime?.() || 0;
            const bTime = b.redeemedAt?.toDate?.()?.getTime?.() || 0;
            return bTime - aTime;
          });
          setRedeemedRewards(redeemed);
        });
      });
      return unsub;
    } catch (err) {
      console.error("Failed to subscribe to redeemed rewards:", err);
    }
  }, [uid]);

  // Load wallet transactions related to rewards
  useEffect(() => {
    if (!uid) return;
    
    const loadWalletTransactions = async () => {
      try {
        setLoadingWalletTxs(true);
        const walletTxRef = collection(database, "wallets", uid, "transactions");
        
        // Load transactions related to rewards
        const q = query(
          walletTxRef,
          where("type", "in", ["host_reward_cashback", "reward_redeemed_cashback"]),
          orderBy("timestamp", "desc"),
          limit(20)
        );
        
        try {
          const snap = await getDocs(q);
          const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setWalletTransactions(txs);
        } catch (err) {
          // Fallback: load all and filter client-side
          console.warn("Failed to load wallet transactions with query, trying fallback:", err);
          const snap = await getDocs(walletTxRef);
          const txs = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((tx) => 
              tx.type === "host_reward_cashback" || 
              tx.type === "reward_redeemed_cashback"
            )
            .sort((a, b) => {
              const aTime = a.timestamp?.toDate?.()?.getTime?.() || 0;
              const bTime = b.timestamp?.toDate?.()?.getTime?.() || 0;
              return bTime - aTime;
            })
            .slice(0, 20);
          setWalletTransactions(txs);
        }
      } catch (err) {
        console.error("Failed to load wallet transactions:", err);
        setWalletTransactions([]);
      } finally {
        setLoadingWalletTxs(false);
      }
    };

    loadWalletTransactions();

    // Subscribe to real-time updates
    const walletTxRef = collection(database, "wallets", uid, "transactions");
    const unsub = onSnapshot(walletTxRef, (snap) => {
      const txs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((tx) => 
          tx.type === "host_reward_cashback" || 
          tx.type === "reward_redeemed_cashback"
        )
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.()?.getTime?.() || 0;
          const bTime = b.timestamp?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        })
        .slice(0, 20);
      setWalletTransactions(txs);
    }, (err) => {
      console.error("Failed to subscribe to wallet transactions:", err);
    });

    return () => unsub();
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
      // Calculate cashback amount based on reward type
      // For host rewards: if fixed, use discountValue; if percentage, calculate on base service fee
      const BASE_SERVICE_FEE = 1000; // Base amount for percentage calculation
      let cashbackAmount = 0;
      const discountType = reward.discountType || "percentage";
      const discountValue = Number(reward.discountValue || 0);

      if (discountType === "percentage") {
        // Calculate cashback as percentage of base service fee
        cashbackAmount = (BASE_SERVICE_FEE * discountValue) / 100;
      } else {
        // Fixed amount
        cashbackAmount = discountValue;
      }
      cashbackAmount = Math.round(cashbackAmount * 100) / 100; // Round to 2 decimal places

      await runTransaction(database, async (tx) => {
        const pointsRef = doc(database, "points", uid);
        const ptsLogRef = doc(collection(database, "points", uid, "transactions"));
        const redeemedRef = doc(collection(database, "hosts", uid, "redeemedRewards"));
        
        // Wallet references (only host wallet, no admin wallet)
        const hostWalletRef = doc(database, "wallets", uid);
        const hostTxRef = doc(collection(database, "wallets", uid, "transactions"));

        // Read current points
        const ptsSnap = await tx.get(pointsRef);
        const currentBalance = Number(ptsSnap.data()?.balance || 0);

        if (currentBalance < reward.pointsCost) {
          throw new Error("Insufficient points");
        }

        // Read host wallet
        const hostWalletSnap = await tx.get(hostWalletRef);
        const hostBalance = Number(hostWalletSnap.data()?.balance || 0);

        const newBalance = currentBalance - reward.pointsCost;
        const newHostBalance = hostBalance + cashbackAmount;

        // Deduct points
        tx.set(
          pointsRef,
          { uid, balance: newBalance, updatedAt: serverTimestamp() },
          { merge: true }
        );

        // Log points transaction
        tx.set(ptsLogRef, {
          uid,
          type: "reward_redeemed",
          delta: -reward.pointsCost,
          amount: reward.pointsCost,
          status: "completed",
          note: `Redeemed: ${reward.name} (Host Reward) - Cashback: ${peso(cashbackAmount)}`,
          rewardId: reward.id,
          balanceAfter: newBalance,
          timestamp: serverTimestamp(),
        });

        // Update host wallet (credit cashback)
        tx.set(hostWalletRef, {
          uid: uid,
          balance: newHostBalance,
          currency: "PHP",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Log host wallet transaction
        tx.set(hostTxRef, {
          uid: uid,
          type: "reward_redeemed_cashback",
          delta: +cashbackAmount,
          amount: cashbackAmount,
          status: "completed",
          method: "reward",
          note: `Reward cashback: ${reward.name} (redeemed)`,
          metadata: {
            rewardId: reward.id,
            rewardName: reward.name,
            pointsCost: reward.pointsCost,
            redemption: true,
          },
          balanceAfter: newHostBalance,
          timestamp: serverTimestamp(),
        });

        // Create redeemed reward (no expiration for hosts)
        // IMPORTANT: Save to hosts/{uid}/redeemedRewards, NOT users/{uid}/redeemedRewards
        const redeemedRewardData = {
          uid: uid, // Required by Firestore security rules
          rewardId: reward.id,
          rewardName: reward.name,
          discountType: reward.discountType || "percentage",
          discountValue: reward.discountValue || 0,
          pointsCost: reward.pointsCost,
          cashbackAmount: cashbackAmount, // Store the cashback amount received
          userType: "host", // Mark as host reward
          used: false,
          redeemedAt: serverTimestamp(),
        };
        
        // Only add optional fields if they exist
        if (reward.type) redeemedRewardData.rewardType = reward.type;
        if (reward.value !== undefined) redeemedRewardData.rewardValue = reward.value;
        // No expiration for host rewards
        
        // Save to hosts collection (NOT users collection)
        tx.set(redeemedRef, redeemedRewardData);
      });

      setSuccessModal({
        open: true,
        message: `Successfully redeemed "${reward.name}"! You received ${peso(cashbackAmount)} cashback in your wallet.`
      });
    } catch (err) {
      console.error("Failed to redeem reward:", err);
      console.error("Error details:", {
        code: err?.code,
        message: err?.message,
        stack: err?.stack,
      });
      
      // Provide more detailed error message
      let errorMessage = "Failed to redeem reward. Please try again.";
      if (err?.code === "permission-denied" || err?.message?.includes("permission")) {
        errorMessage = "Permission denied. Please ensure Firestore security rules have been deployed. Check the browser console for details.";
      } else if (err?.message) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
    } finally {
      setRedeeming(null);
    }
  };

  const activeRewards = useMemo(() => {
    return redeemedRewards.filter((r) => !r.used);
  }, [redeemedRewards]);

  const usedRewards = useMemo(() => {
    return redeemedRewards.filter((r) => r.used);
  }, [redeemedRewards]);

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
    <>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Points & Rewards</h1>
          <p className="text-muted-foreground">View your points balance and redeem rewards for cashback on service fees.</p>
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
                  <p className="text-4xl font-bold text-slate-900 mt-1">
                    {formatPoints(points.balance)}
                  </p>
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
                  Check back later for new rewards!
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
                                {reward.discountValue || reward.value}% Cashback
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                <Tag size={12} />
                                ₱{Number(reward.discountValue || reward.value).toLocaleString()} Cashback
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

        {/* Wallet Transactions Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-500" />
            Reward Transactions
          </h2>

          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-6">
            {loadingWalletTxs ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Line key={i} />
                ))}
              </div>
            ) : walletTransactions.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="mx-auto text-slate-300 mb-3" size={48} />
                <p className="text-sm text-slate-600 mb-2">No reward transactions yet.</p>
                <p className="text-xs text-slate-500">Wallet transactions from redeemed rewards will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {walletTransactions.map((tx) => {
                  const delta = Number(tx.delta || 0);
                  const amount = Number(tx.amount || Math.abs(delta));
                  const isPositive = delta > 0;
                  
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white/50 hover:bg-white transition"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-2 rounded-lg ${
                          isPositive ? "bg-emerald-100" : "bg-rose-100"
                        }`}>
                          {isPositive ? (
                            <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-slate-900">{tx.note || "Reward Cashback"}</p>
                            <Badge kind={tx.status === "completed" ? "success" : "warning"}>
                              {tx.status || "completed"}
                            </Badge>
                          </div>
                          {tx.metadata?.rewardName && (
                            <p className="text-sm text-slate-600 mt-1">Reward: {tx.metadata.rewardName}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {formatDate(tx.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p
                          className={`text-lg font-bold ${
                            isPositive ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isPositive ? "+" : "-"}
                          {peso(amount)}
                        </p>
                        {tx.balanceAfter !== undefined && (
                          <p className="text-xs text-slate-500 mt-1">
                            Balance: {peso(tx.balanceAfter)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {successModal.open && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSuccessModal({ open: false, message: "" })} />
          <div className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900">Success!</h3>
                {successModal.message && (
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-line">{successModal.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSuccessModal({ open: false, message: "" })}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Redeemed Rewards Modal */}
      {showRedeemedModal && createPortal(
        <RedeemedRewardsModal
          open={showRedeemedModal}
          onClose={() => setShowRedeemedModal(false)}
          redeemedRewards={redeemedRewards}
          activeRewards={activeRewards}
          usedRewards={usedRewards}
        />,
          document.body
        )}
    </>
  );
}

/* ======================= Redeemed Rewards Modal ======================= */
function RedeemedRewardsModal({ open, onClose, redeemedRewards = [], activeRewards = [], usedRewards = [] }) {
  const [activeTab, setActiveTab] = useState("active");

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">My Redeemed Rewards ({redeemedRewards.length})</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "active"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Active ({activeRewards.length})
          </button>
          <button
            onClick={() => setActiveTab("used")}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === "used"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            Used ({usedRewards.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "active" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRewards.length === 0 ? (
                <p className="text-sm text-slate-600 col-span-2 text-center py-8">
                  No active rewards.
                </p>
              ) : (
                activeRewards.map((redeemed) => (
                  <div
                    key={redeemed.id}
                    className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-slate-900">{redeemed.rewardName}</h4>
                      <Badge kind="success">Active</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {redeemed.discountType === "percentage" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Percent size={10} />
                          {redeemed.discountValue}% Cashback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Tag size={10} />
                          ₱{Number(redeemed.discountValue || 0).toLocaleString()} Cashback
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Redeemed: {formatDate(redeemed.redeemedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "used" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {usedRewards.length === 0 ? (
                <p className="text-sm text-slate-600 col-span-2 text-center py-8">
                  No used rewards yet.
                </p>
              ) : (
                usedRewards.map((redeemed) => (
                  <div
                    key={redeemed.id}
                    className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4 opacity-75"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-slate-900">{redeemed.rewardName}</h4>
                      <Badge kind="muted">Used</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {redeemed.discountType === "percentage" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Percent size={10} />
                          {redeemed.discountValue}% Cashback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Tag size={10} />
                          ₱{Number(redeemed.discountValue || 0).toLocaleString()} Cashback
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Used on: {formatDate(redeemed.usedAt)}<br />
                      Redeemed: {formatDate(redeemed.redeemedAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  );
}

