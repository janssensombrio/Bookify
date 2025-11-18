// src/pages/host/components/ClaimRewardModal.jsx
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { database, auth } from "../../../config/firebase";
import { Gift, X, Loader2, AlertCircle, CheckCircle2, Percent, Tag } from "lucide-react";

const ADMIN_WALLET_ID = "admin";

export default function ClaimRewardModal({ open, onClose, booking, serviceFee }) {
  const [hostRewards, setHostRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const hostUid = auth.currentUser?.uid;

  // Load active host rewards
  useEffect(() => {
    if (!open || !hostUid) return;

    const loadRewards = async () => {
      try {
        setLoading(true);
        setError(null);
        const redeemedRef = collection(database, "hosts", hostUid, "redeemedRewards");
        
        // Try ordered query first
        let snap;
        try {
          const q = query(redeemedRef, where("used", "==", false), orderBy("redeemedAt", "desc"));
          snap = await getDocs(q);
        } catch (err) {
          // Fallback: load all and filter client-side
          snap = await getDocs(redeemedRef);
        }

        const allRewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        
        // Filter active, unused rewards (no expiration for hosts)
        const activeRewards = allRewards.filter((r) => !r.used);

        setHostRewards(activeRewards);
      } catch (err) {
        console.error("Failed to load host rewards:", err);
        setError("Failed to load rewards. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadRewards();
  }, [open, hostUid]);

  const handleClaimReward = async (reward) => {
    if (!booking || !hostUid || !serviceFee || serviceFee <= 0) return;

    setClaiming(reward.id);
    setError(null);
    setSuccess(null);

    try {
      // Calculate cashback
      const discountType = reward.discountType || "percentage";
      const discountValue = Number(reward.discountValue || 0);
      let cashback = 0;

      if (discountType === "percentage") {
        cashback = (serviceFee * discountValue) / 100;
      } else {
        cashback = Math.min(serviceFee, discountValue); // Fixed amount, capped at service fee
      }

      cashback = Math.round(cashback * 100) / 100; // Round to 2 decimal places

      if (cashback <= 0) {
        throw new Error("Invalid cashback amount");
      }

      await runTransaction(database, async (tx) => {
        // 1. Read admin wallet
        const adminWalletRef = doc(database, "wallets", ADMIN_WALLET_ID);
        const adminWalletSnap = await tx.get(adminWalletRef);
        const adminBalance = Number(adminWalletSnap.data()?.balance || 0);

        if (adminBalance < cashback) {
          throw new Error("Insufficient admin wallet balance");
        }

        // 2. Read host wallet
        const hostWalletRef = doc(database, "wallets", hostUid);
        const hostWalletSnap = await tx.get(hostWalletRef);
        const hostBalance = Number(hostWalletSnap.data()?.balance || 0);

        // 3. Read reward to check if still unused
        const rewardRef = doc(database, "hosts", hostUid, "redeemedRewards", reward.id);
        const rewardSnap = await tx.get(rewardRef);
        const rewardData = rewardSnap.data();

        if (!rewardSnap.exists || rewardData?.used) {
          throw new Error("Reward has already been used");
        }

        // No expiration check for host rewards

        // 4. Deduct from admin wallet
        const newAdminBalance = adminBalance - cashback;
        tx.set(adminWalletRef, {
          uid: ADMIN_WALLET_ID,
          balance: newAdminBalance,
          currency: "PHP",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 5. Credit to host wallet
        const newHostBalance = hostBalance + cashback;
        tx.set(hostWalletRef, {
          uid: hostUid,
          balance: newHostBalance,
          currency: "PHP",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // 6. Create admin transaction
        const adminTxRef = doc(collection(database, "wallets", ADMIN_WALLET_ID, "transactions"));
        tx.set(adminTxRef, {
          uid: ADMIN_WALLET_ID,
          type: "host_reward_cashback",
          delta: -cashback,
          amount: cashback,
          status: "completed",
          method: "reward",
          note: `Host reward cashback: ${reward.rewardName || "Reward"} for booking ${booking.id}`,
          metadata: {
            bookingId: booking.id,
            hostId: hostUid,
            rewardId: reward.id,
          },
          balanceAfter: newAdminBalance,
          timestamp: serverTimestamp(),
        });

        // 7. Create host transaction
        const hostTxRef = doc(collection(database, "wallets", hostUid, "transactions"));
        tx.set(hostTxRef, {
          uid: hostUid,
          type: "host_reward_cashback",
          delta: +cashback,
          amount: cashback,
          status: "completed",
          method: "reward",
          note: `Reward cashback: ${reward.rewardName || "Reward"} from booking ${booking.id}`,
          metadata: {
            bookingId: booking.id,
            rewardId: reward.id,
            serviceFee,
          },
          balanceAfter: newHostBalance,
          timestamp: serverTimestamp(),
        });

        // 8. Mark reward as used
        tx.update(rewardRef, {
          used: true,
          usedAt: serverTimestamp(),
          bookingId: booking.id,
          cashbackAmount: cashback,
        });

        // 9. Update booking to track reward claim
        const bookingRef = doc(database, "bookings", booking.id);
        tx.update(bookingRef, {
          hostRewardId: reward.id,
          hostRewardCashback: cashback,
          hostRewardName: reward.rewardName || "Reward",
          updatedAt: serverTimestamp(),
        });
      });

      setSuccess({
        message: `Successfully claimed ${reward.rewardName}! You received ₱${cashback.toLocaleString()} cashback.`,
        cashback,
      });

      // Reload rewards after a delay
      setTimeout(() => {
        const redeemedRef = collection(database, "hosts", hostUid, "redeemedRewards");
        getDocs(query(redeemedRef, where("used", "==", false))).then((snap) => {
          const activeRewards = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setHostRewards(activeRewards);
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to claim reward:", err);
      setError(err.message || "Failed to claim reward. Please try again.");
    } finally {
      setClaiming(null);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Claim Reward</h3>
            <p className="text-sm text-slate-600 mt-1">
              Get cashback from service fees. Service fee for this booking: ₱{serviceFee?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {success && (
          <div className="mb-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={20} />
              <p className="font-medium">{success.message}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-3 text-sm text-emerald-700 hover:text-emerald-800 underline"
            >
              Close
            </button>
          </div>
        )}

        {error && !success && (
          <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertCircle size={20} />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : hostRewards.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-600">No active rewards available.</p>
              <p className="text-sm text-slate-500 mt-1">Redeem rewards from the Rewards page to use them here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {hostRewards.map((reward) => {
                // Calculate potential cashback
                const discountType = reward.discountType || "percentage";
                const discountValue = Number(reward.discountValue || 0);
                let potentialCashback = 0;
                if (discountType === "percentage") {
                  potentialCashback = (serviceFee * discountValue) / 100;
                } else {
                  potentialCashback = Math.min(serviceFee, discountValue);
                }
                potentialCashback = Math.round(potentialCashback * 100) / 100;

                const isClaiming = claiming === reward.id;

                return (
                  <div
                    key={reward.id}
                    className="rounded-xl border-2 border-purple-200 bg-purple-50 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-slate-900">{reward.rewardName}</h4>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {discountType === "percentage" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Percent size={10} />
                          {discountValue}% Cashback
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <Tag size={10} />
                          ₱{discountValue.toLocaleString()} Cashback
                        </span>
                      )}
                    </div>
                    <div className="mt-2 p-2 bg-white rounded-lg">
                      <p className="text-xs text-slate-600 mb-1">You will receive:</p>
                      <p className="text-lg font-bold text-purple-600">
                        ₱{potentialCashback.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Cashback from service fee</p>
                    </div>
                    <button
                      onClick={() => handleClaimReward(reward)}
                      disabled={isClaiming || !!success}
                      className="w-full mt-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="animate-spin inline mr-2" size={16} />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Gift className="inline mr-2" size={16} />
                          Claim Reward
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

