import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

initializeApp();
const db = getFirestore();
const REGION = "asia-southeast1";

type Booking = {
  hostId?: string;
  totalPrice?: number;
  serviceFee?: number;
  paymentStatus?: string;
  status?: string;
  hostPayoutStatus?: "paid" | "pending" | "failed";
  hostPayoutAmount?: number;
  currency?: string;
  listingId?: string;
  listingTitle?: string;
  guestEmail?: string;
  uid?: string;
};

async function processHostPayout(bookingId: string) {
  await db.runTransaction(async (tx) => {
    const bRef = db.collection("bookings").doc(bookingId);
    const bSnap = await tx.get(bRef);
    if (!bSnap.exists) throw new Error(`Booking ${bookingId} not found`);

    const b = bSnap.data() as Booking;

    if (!b.hostId) throw new Error("hostId missing on booking");
    if (b.hostPayoutStatus === "paid") return; // idempotent

    const isPaid = (b.paymentStatus || "").toLowerCase() === "paid";
    const isConfirmed = (b.status || "").toLowerCase() === "confirmed";
    if (!isPaid || !isConfirmed) throw new Error("Booking is not paid & confirmed yet");

    const total = Number(b.totalPrice || 0);
    const serviceFee = Number(b.serviceFee || 0);
    const payout = Math.max(0, total - serviceFee);

    const hostId = b.hostId;
    const walletRef = db.collection("wallets").doc(hostId);
    const walletSnap = await tx.get(walletRef);
    const currentBal = Number(walletSnap.data()?.balance || 0);

    tx.set(
      walletRef,
      {
        uid: hostId,
        balance: FieldValue.increment(payout),
        currency: b.currency || "PHP",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const ledgerRef = walletRef.collection("transactions").doc();
    tx.set(ledgerRef, {
      uid: hostId,
      type: "host_payout",
      delta: payout,
      amount: payout,
      status: "completed",
      method: "system",
      note: `Payout for booking ${bookingId}${b.listingTitle ? ` — ${b.listingTitle}` : ""}`,
      metadata: { bookingId, listingId: b.listingId || null, serviceFee },
      balanceAfter: currentBal + payout,
      timestamp: FieldValue.serverTimestamp(),
    });

    const pointsRef = db.collection("points").doc(hostId);
    const pointsSnap = await tx.get(pointsRef);
    const curPts = Number(pointsSnap.data()?.balance || 0);
    const nextPts = curPts + 100;

    tx.set(pointsRef, { uid: hostId, balance: nextPts, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const ptsLogRef = pointsRef.collection("transactions").doc();
    tx.set(ptsLogRef, {
      uid: hostId,
      type: "host_booking_reward",
      delta: 100,
      amount: 100,
      status: "completed",
      note: `Reward for booking ${bookingId}`,
      bookingId,
      balanceAfter: nextPts,
      timestamp: FieldValue.serverTimestamp(),
    });

    tx.update(bRef, {
      hostPayoutStatus: "paid",
      hostPayoutAmount: payout,
      hostPayoutAt: FieldValue.serverTimestamp(),
    });
  });
}

export const onBookingCreated = onDocumentCreated(
  { document: "bookings/{bookingId}", region: REGION },
  async (event) => {
    const b = event.data?.data() as Booking | undefined;
    if (!b) return;
    const id = event.params.bookingId;

    const isPaid = (b.paymentStatus || "").toLowerCase() === "paid";
    const isConfirmed = (b.status || "").toLowerCase() === "confirmed";

    if (isPaid && isConfirmed && b.hostId && b.hostPayoutStatus !== "paid") {
      try {
        await processHostPayout(id);
        logger.info(`Payout processed (create) for booking ${id}`);
      } catch (e) {
        logger.error(`Payout on create failed for ${id}`, e);
      }
    }
  }
);

export const onBookingUpdated = onDocumentUpdated(
  { document: "bookings/{bookingId}", region: REGION },
  async (event) => {
    const before = event.data?.before.data() as Booking | undefined;
    const after = event.data?.after.data() as Booking | undefined;
    if (!after) return;
    const id = event.params.bookingId;

    const becamePaid =
      ((before?.paymentStatus || "").toLowerCase() !== "paid") &&
      ((after.paymentStatus || "").toLowerCase() === "paid");
    const becameConfirmed =
      ((before?.status || "").toLowerCase() !== "confirmed") &&
      ((after.status || "").toLowerCase() === "confirmed");

    const isPaidAndConfirmed =
      ((after.paymentStatus || "").toLowerCase() === "paid") &&
      ((after.status || "").toLowerCase() === "confirmed");

    if ((becamePaid || becameConfirmed) &&
        isPaidAndConfirmed &&
        after.hostId &&
        after.hostPayoutStatus !== "paid") {
      try {
        await processHostPayout(id);
        logger.info(`Payout processed (update) for booking ${id}`);
      } catch (e) {
        logger.error(`Payout on update failed for ${id}`, e);
      }
    }
  }
);
