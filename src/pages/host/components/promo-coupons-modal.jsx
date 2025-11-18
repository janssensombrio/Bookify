// src/pages/host/components/promo-coupons-modal.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { database, auth } from "../../../config/firebase";
import {
  Tag,
  Percent,
  Gift,
  X,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  Calendar,
  Clock,
} from "lucide-react";
import { DateRangePicker } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

/* =========================================================
   Small UI helpers
========================================================= */
function Field({ label, children, help, error }) {
  return (
    <div className="grid gap-1.5">
      {label ? <label className="text-sm font-medium text-slate-800">{label}</label> : null}
      {children}
      {help ? <p className="text-xs text-slate-500">{help}</p> : null}
      {error ? (
        <div className="flex items-center gap-1 text-xs text-rose-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function Badge({ tone = "blue", children }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/* =========================================================
   Date Range Field Component
========================================================= */
function CouponDateRangeField({ label, value = { start: "", end: "" }, onChange, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  // Convert string dates to Date objects for react-date-range
  const startDate = value.start ? new Date(value.start) : new Date();
  const endDate = value.end ? new Date(value.end) : new Date();

  // DateRange state for react-date-range
  const [dateRange, setDateRange] = useState({
    startDate: startDate,
    endDate: endDate,
    key: "selection",
  });

  // Update dateRange when value prop changes
  useEffect(() => {
    if (value.start && value.end) {
      setDateRange({
        startDate: new Date(value.start),
        endDate: new Date(value.end),
        key: "selection",
      });
    }
  }, [value.start, value.end]);

  // Calculate position when opening (above the button)
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          // Estimate calendar height (approximately 350px for single month)
          const calendarHeight = 350;
          setPosition({
            top: rect.top + window.scrollY - calendarHeight - 8, // Position above with 8px gap
            left: rect.left + window.scrollX,
            width: Math.max(rect.width, 600),
          });
        }
      };
      
      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
      
      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickInsideContainer = containerRef.current?.contains(event.target);
      const isClickInsideDropdown = dropdownRef.current?.contains(event.target);
      if (!isClickInsideContainer && !isClickInsideDropdown) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (ranges) => {
    const selection = ranges.selection;
    setDateRange(selection);
    
    // Convert Date objects to YYYY-MM-DD format
    const formatDate = (date) => {
      if (!date) return "";
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    onChange?.({
      start: formatDate(selection.startDate),
      end: formatDate(selection.endDate),
    });
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const displayText = value.start && value.end
    ? `${formatDisplayDate(value.start)} - ${formatDisplayDate(value.end)}`
    : value.start
    ? `${formatDisplayDate(value.start)} - ...`
    : "Select date range";

  return (
    <Field label={label} error={error}>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border text-sm transition ${
            value.start || value.end
              ? "border-blue-300 bg-blue-50 text-blue-700"
              : "border-slate-300 bg-white/90 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Calendar size={16} className="shrink-0" />
            <span className="truncate">{displayText}</span>
          </div>
          {value.start || value.end ? (
            <X
              size={14}
              onClick={(e) => {
                e.stopPropagation();
                onChange?.({ start: "", end: "" });
              }}
              className="shrink-0 hover:text-red-600 transition cursor-pointer"
            />
          ) : null}
        </button>

        {isOpen &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[99999] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
              style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
              }}
            >
              <div className="p-4">
                <DateRangePicker
                  ranges={[dateRange]}
                  onChange={handleSelect}
                  months={1}
                  direction="horizontal"
                  showDateDisplay={false}
                  rangeColors={["#3b82f6"]}
                  minDate={new Date()}
                />
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </Field>
  );
}

/* =========================================================
   Confirm Delete Modal (no window.confirm)
========================================================= */
function ConfirmDeleteModal({ open, itemLabel, busy, onCancel, onConfirm }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-[121] mx-auto my-8 w-[min(560px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-11 h-11 rounded-xl bg-rose-100 text-rose-700">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Delete item?</h3>
            <p className="text-sm text-slate-600 mt-1">
              This will permanently remove <b className="text-slate-900">{itemLabel || "this item"}</b>. This
              action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   Promo & Coupon Modal
========================================================= */
export default function PromoCouponsModal({ open, onClose }) {
  const user = auth.currentUser;
  const ownerUid = user?.uid || null;

  const [activeTab, setActiveTab] = useState("coupons"); // 'coupons' | 'promos'
  const [loading, setLoading] = useState(true);

  const [listings, setListings] = useState([]);
  const [promos, setPromos] = useState([]);
  const [coupons, setCoupons] = useState([]);

  // Create/Edit states
  const initialCoupon = {
    id: null,
    code: "",
    discountType: "percentage", // 'percentage' | 'fixed'
    discountValue: "",
    maxUses: "",
    perUserLimit: "",
    appliesTo: "all", // 'all' | 'selected'
    listingIds: [],
    minSubtotal: "",
    startsAt: "",
    endsAt: "",
    status: "active", // 'active' | 'paused'
  };
  const initialPromo = {
    id: null,
    title: "",
    description: "",
    discountType: "percentage", // 'percentage' | 'fixed'
    discountValue: "",
    appliesTo: "all",
    listingIds: [],
    minSubtotal: "",
    startsAt: "",
    endsAt: "",
    status: "active",
  };

  const [couponForm, setCouponForm] = useState(initialCoupon);
  const [promoForm, setPromoForm] = useState(initialPromo);

  const [saving, setSaving] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);

  // Deletion state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState({ type: "", id: null, label: "" });
  const [deletingId, setDeletingId] = useState(null);

  // Load data on open
  useEffect(() => {
    if (!open || !ownerUid) return;
    (async () => {
      setLoading(true);
      try {
        // Listings (owned by uid)
        const lSnap = await getDocs(query(collection(database, "listings"), where("uid", "==", ownerUid)));
        setListings(lSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Backwards-compatible loader for promos/coupons:
        async function loadOwnerScoped(collName) {
          const map = new Map();
          const mineByUid = await getDocs(query(collection(database, collName), where("uid", "==", ownerUid)));
          mineByUid.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
          // Legacy docs that used { ownerUid }:
          const legacy = await getDocs(query(collection(database, collName), where("ownerUid", "==", ownerUid)));
          legacy.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
          return Array.from(map.values());
        }

        setPromos(await loadOwnerScoped("promos"));
        setCoupons(await loadOwnerScoped("coupons"));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, ownerUid]);

  /* ------------------------ Shared Helpers ------------------------ */
  const listingOptions = useMemo(
    () => listings.map((l) => ({ id: l.id, title: l.title || "Untitled" })),
    [listings]
  );

  const toggleIdInList = (list, id) => {
    const s = new Set(list || []);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return Array.from(s);
  };

  const toNumberOrNull = (v) => {
    if (v === "" || v === null || typeof v === "undefined") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const toDateOrNull = (v) => {
    const s = String(v || "").trim();
    if (!s) return null;
    // accept only YYYY-MM-DD; return it as-is
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  // NEW: Robustly convert various date shapes into YYYY-MM-DD
  const toYMD = (v) => {
    if (!v) return "";
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
    if (v instanceof Date) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const dd = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }
    const s = String(v).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  };

  const fmtDateRange = (startsAt, endsAt) => {
    const s = startsAt ? new Date(`${startsAt}T00:00:00`).toLocaleDateString() : "—";
    const e = endsAt ? new Date(`${endsAt}T00:00:00`).toLocaleDateString() : "—";
    return `${s} → ${e}`;
  };

  const percentOrCurrency = (type, value) =>
    type === "percentage" ? `${Number(value || 0)}%` : `₱${Number(value || 0).toLocaleString()}`;

  /* ------------------------ Coupon CRUD ------------------------ */
  const validateCoupon = (f) => {
    const errs = {};
    if (!f.code.trim()) errs.code = "Coupon code is required.";
    if (!f.discountValue || Number(f.discountValue) <= 0) errs.discountValue = "Enter a valid discount.";
    if (f.appliesTo === "selected" && (!f.listingIds || f.listingIds.length === 0))
      errs.listingIds = "Select at least one listing.";
    if (f.discountType === "percentage") {
      const v = Number(f.discountValue);
      if (v <= 0 || v > 100) errs.discountValue = "Percentage must be between 1 and 100.";
    }
    if (f.startsAt && f.endsAt) {
      if (new Date(`${f.startsAt}T00:00:00`) > new Date(`${f.endsAt}T00:00:00`)) {
        errs.endsAt = "End date must be after start date.";
      }
    }
    return errs;
  };

  const loadCouponForEdit = (c) => {
    setCouponForm({
      id: c.id,
      code: c.code || "",
      discountType: c.discountType || "percentage",
      discountValue: String(c.discountValue ?? ""),
      maxUses: c.maxUses != null ? String(c.maxUses) : "",
      perUserLimit: c.perUserLimit != null ? String(c.perUserLimit) : "",
      appliesTo: c.appliesTo || "all",
      listingIds: Array.isArray(c.listingIds) ? c.listingIds : [],
      minSubtotal: c.minSubtotal != null ? String(c.minSubtotal) : "",
      startsAt: toYMD(c.startsAt),
      endsAt: toYMD(c.endsAt),
      status: c.status || "active",
    });
    setActiveTab("coupons");
  };

  const resetCouponForm = () => setCouponForm(initialCoupon);

  const [couponErrors, setCouponErrors] = useState({});

  const saveCoupon = async () => {
    if (!ownerUid) {
      alert("You’re signed out. Please sign in and try again.");
      return;
    }
    const errs = validateCoupon(couponForm);
    if (Object.keys(errs).length) {
      setCouponErrors(errs);
      return;
    }
    setCouponErrors({});
    setSaving(true);
    try {
      const payload = {
        // REQUIRED by your rules:
        uid: ownerUid,
        // keep legacy field for old records/queries:
        ownerUid: ownerUid,
        // business fields:
        code: couponForm.code.trim(),
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        maxUses: toNumberOrNull(couponForm.maxUses),
        perUserLimit: toNumberOrNull(couponForm.perUserLimit),
        appliesTo: couponForm.appliesTo,
        listingIds: couponForm.appliesTo === "selected" ? couponForm.listingIds : [],
        minSubtotal: toNumberOrNull(couponForm.minSubtotal),
        startsAt: toDateOrNull(couponForm.startsAt),
        endsAt: toDateOrNull(couponForm.endsAt),
        status: couponForm.status || "active",
        updatedAt: serverTimestamp(),
      };

      if (!couponForm.id) {
        await addDoc(collection(database, "coupons"), {
          ...payload,
          usedCount: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(database, "coupons", couponForm.id), payload);
      }

      // refresh (supports both new uid and legacy ownerUid)
      const mineByUid = await getDocs(query(collection(database, "coupons"), where("uid", "==", ownerUid)));
      const mineByOwnerUid = await getDocs(
        query(collection(database, "coupons"), where("ownerUid", "==", ownerUid))
      );
      const merged = new Map();
      mineByUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      mineByOwnerUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      setCoupons(Array.from(merged.values()));
      resetCouponForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const toggleCouponStatus = async (c) => {
    try {
      const next = c.status === "active" ? "paused" : "active";
      await updateDoc(doc(database, "coupons", c.id), {
        uid: ownerUid, // ensure rule passes for legacy docs
        ownerUid: ownerUid,
        status: next,
        updatedAt: serverTimestamp(),
      });
      setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    }
  };

  /* ------------------------ Promo CRUD ------------------------ */
  const validatePromo = (f) => {
    const errs = {};
    if (!f.title.trim()) errs.title = "Title is required.";
    if (!f.discountValue || Number(f.discountValue) <= 0) errs.discountValue = "Enter a valid discount.";
    if (f.appliesTo === "selected" && (!f.listingIds || f.listingIds.length === 0))
      errs.listingIds = "Select at least one listing.";
    if (f.discountType === "percentage") {
      const v = Number(f.discountValue);
      if (v <= 0 || v > 100) errs.discountValue = "Percentage must be between 1 and 100.";
    }
    if (f.startsAt && f.endsAt) {
      if (new Date(`${f.startsAt}T00:00:00`) > new Date(`${f.endsAt}T00:00:00`)) {
        errs.endsAt = "End date must be after start date.";
      }
    }
    return errs;
  };

  const loadPromoForEdit = (p) => {
    setPromoForm({
      id: p.id,
      title: p.title || "",
      description: p.description || "",
      discountType: p.discountType || "percentage",
      discountValue: String(p.discountValue ?? ""),
      appliesTo: p.appliesTo || "all",
      listingIds: Array.isArray(p.listingIds) ? p.listingIds : [],
      minSubtotal: p.minSubtotal != null ? String(p.minSubtotal) : "",
      startsAt: toYMD(p.startsAt),
      endsAt: toYMD(p.endsAt),
      status: p.status || "active",
    });
    setActiveTab("promos");
  };

  const resetPromoForm = () => setPromoForm(initialPromo);
  const [promoErrors, setPromoErrors] = useState({});

  const savePromo = async () => {
    if (!ownerUid) {
      alert("You’re signed out. Please sign in and try again.");
      return;
    }
    const errs = validatePromo(promoForm);
    if (Object.keys(errs).length) {
      setPromoErrors(errs);
      return;
    }
    setPromoErrors({});
    setSavingPromo(true);
    try {
      const payload = {
        uid: ownerUid,       // REQUIRED by rules
        ownerUid: ownerUid,  // legacy compatibility
        title: promoForm.title.trim(),
        description: promoForm.description.trim(),
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue),
        appliesTo: promoForm.appliesTo,
        listingIds: promoForm.appliesTo === "selected" ? promoForm.listingIds : [],
        minSubtotal: toNumberOrNull(promoForm.minSubtotal),
        startsAt: toDateOrNull(promoForm.startsAt),
        endsAt: toDateOrNull(promoForm.endsAt),
        status: promoForm.status || "active",
        updatedAt: serverTimestamp(),
      };

      if (!promoForm.id) {
        await addDoc(collection(database, "promos"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(database, "promos", promoForm.id), payload);
      }

      const mineByUid = await getDocs(query(collection(database, "promos"), where("uid", "==", ownerUid)));
      const mineByOwnerUid = await getDocs(
        query(collection(database, "promos"), where("ownerUid", "==", ownerUid))
      );
      const merged = new Map();
      mineByUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      mineByOwnerUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
      setPromos(Array.from(merged.values()));
      resetPromoForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save promo.");
    } finally {
      setSavingPromo(false);
    }
  };

  const togglePromoStatus = async (p) => {
    try {
      const next = p.status === "active" ? "paused" : "active";
      await updateDoc(doc(database, "promos", p.id), {
        uid: ownerUid, // ensure rule passes for legacy docs
        ownerUid: ownerUid,
        status: next,
        updatedAt: serverTimestamp(),
      });
      setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    }
  };

  /* ------------------------ Delete (with legacy repair) ------------------------ */
  const safeDelete = async (coll, id) => {
    const ref = doc(database, coll, id);
    try {
      await deleteDoc(ref); // will pass if resource.data.uid == auth.uid
    } catch (e) {
      // If legacy doc has no uid, patch uid then delete (your rules allow update based on request.resource.data.uid)
      try {
        await updateDoc(ref, { uid: ownerUid, ownerUid: ownerUid, updatedAt: serverTimestamp() });
        await deleteDoc(ref);
      } catch (e2) {
        throw e2;
      }
    }
  };

  const requestDeleteCoupon = (id, code) => {
    setPendingDelete({ type: "coupon", id, label: code || "coupon" });
    setConfirmOpen(true);
  };

  const requestDeletePromo = (id, title) => {
    setPendingDelete({ type: "promo", id, label: title || "promo" });
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete.id || !pendingDelete.type) {
      setConfirmOpen(false);
      return;
    }
    try {
      setDeletingId(pendingDelete.id);
      if (pendingDelete.type === "coupon") {
        await safeDelete("coupons", pendingDelete.id);
        const mineByUid = await getDocs(query(collection(database, "coupons"), where("uid", "==", ownerUid)));
        const mineByOwnerUid = await getDocs(
          query(collection(database, "coupons"), where("ownerUid", "==", ownerUid))
        );
        const merged = new Map();
        mineByUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        mineByOwnerUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        setCoupons(Array.from(merged.values()));
      } else if (pendingDelete.type === "promo") {
        await safeDelete("promos", pendingDelete.id);
        const mineByUid = await getDocs(query(collection(database, "promos"), where("uid", "==", ownerUid)));
        const mineByOwnerUid = await getDocs(
          query(collection(database, "promos"), where("ownerUid", "==", ownerUid))
        );
        const merged = new Map();
        mineByUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        mineByOwnerUid.docs.forEach((d) => merged.set(d.id, { id: d.id, ...d.data() }));
        setPromos(Array.from(merged.values()));
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    } finally {
      setDeletingId(null);
      setConfirmOpen(false);
      setPendingDelete({ type: "", id: null, label: "" });
    }
  };

  /* ------------------------ Lists & UI ------------------------ */
  const [statusFilter, setStatusFilter] = useState("all"); // 'all'|'active'|'paused'
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusLabel = statusFilter === "all" ? "All" : statusFilter === "active" ? "Active" : "Paused";

  const visibleCoupons = useMemo(() => {
    if (statusFilter === "all") return coupons;
    return coupons.filter((c) => c.status === statusFilter);
  }, [coupons, statusFilter]);

  const visiblePromos = useMemo(() => {
    if (statusFilter === "all") return promos;
    return promos.filter((p) => p.status === statusFilter);
  }, [promos, statusFilter]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative z-[111] mx-auto my-6 w-[min(1100px,calc(100vw-20px))] rounded-3xl border border-white/70 bg-gradient-to-br from-blue-50 via-white to-indigo-50 shadow-[0_12px_30px_rgba(30,58,138,0.12),_0_40px_80px_rgba(30,58,138,0.12)]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/60 bg-white/85 px-4 sm:px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 ring-4 ring-white/60 shadow">
              <Gift className="w-4.5 h-4.5" />
            </span>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Promos & Coupons</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[78vh] overflow-y-auto p-4 sm:p-6 md:p-8">
          {/* Tabs + filter */}
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("coupons")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === "coupons"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Tag className="w-4 h-4" />
                Coupons
              </button>
              <button
                onClick={() => setActiveTab("promos")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition ${
                  activeTab === "promos"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                    : "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Percent className="w-4 h-4" />
                Promos
              </button>
            </div>

            {/* Status filter */}
            <div className="relative">
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow hover:bg-slate-50"
              >
                Status: {statusLabel}
                <ChevronDown className={`w-4 h-4 transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {statusDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[112]"
                    onClick={() => setStatusDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-[113]">
                    {["all", "active", "paused"].map((v) => (
                      <button
                        key={v}
                        onClick={() => {
                          setStatusFilter(v);
                          setStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors ${
                          statusFilter === v ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                        }`}
                      >
                        {v === "all" ? "All" : v === "active" ? "Active" : "Paused"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="mt-8 flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading…</span>
            </div>
          ) : null}

          {/* CONTENT */}
          {!loading && activeTab === "coupons" && (
            <div className="mt-6 grid lg:grid-cols-2 gap-6">
              {/* Left: composer */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    {couponForm.id ? "Edit Coupon" : "Create Coupon"}
                  </h3>
                  {couponForm.id ? <Badge tone="amber">Editing</Badge> : <Badge tone="blue">New</Badge>}
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Coupon Code" error={couponErrors.code}>
                    <input
                      type="text"
                      placeholder="SAVE10, EARLYBIRD, etc."
                      value={couponForm.code}
                      onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Discount Type">
                      <select
                        value={couponForm.discountType}
                        onChange={(e) => setCouponForm((p) => ({ ...p, discountType: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (₱)</option>
                      </select>
                    </Field>
                    <Field label="Discount Value" error={couponErrors.discountValue}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={couponForm.discountValue}
                        onChange={(e) => setCouponForm((p) => ({ ...p, discountValue: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Max Uses (overall)">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave blank for unlimited"
                        value={couponForm.maxUses}
                        onChange={(e) => setCouponForm((p) => ({ ...p, maxUses: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5"
                      />
                    </Field>
                    <Field label="Per-User Limit">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Leave blank for unlimited"
                        value={couponForm.perUserLimit}
                        onChange={(e) => setCouponForm((p) => ({ ...p, perUserLimit: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5"
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Applies To">
                      <select
                        value={couponForm.appliesTo}
                        onChange={(e) => setCouponForm((p) => ({ ...p, appliesTo: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5"
                      >
                        <option value="all">All listings</option>
                        <option value="selected">Specific listings</option>
                      </select>
                    </Field>
                    <Field label="Min. Subtotal (optional)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="₱"
                        value={couponForm.minSubtotal}
                        onChange={(e) => setCouponForm((p) => ({ ...p, minSubtotal: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5"
                      />
                    </Field>
                  </div>

                  {couponForm.appliesTo === "selected" && (
                    <Field label="Select Listings" error={couponErrors.listingIds}>
                      <div className="grid gap-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                        {listingOptions.length === 0 && (
                          <p className="text-xs text-slate-500 px-2">No listings found.</p>
                        )}
                        {listingOptions.map((opt) => {
                          const checked = couponForm.listingIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setCouponForm((p) => ({
                                    ...p,
                                    listingIds: toggleIdInList(p.listingIds, opt.id),
                                  }))
                                }
                              />
                              <span className="text-sm">{opt.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </Field>
                  )}

                  <CouponDateRangeField
                    label="Date Range"
                    value={{ start: couponForm.startsAt, end: couponForm.endsAt }}
                    onChange={(range) => {
                      setCouponForm((p) => ({
                        ...p,
                        startsAt: range.start,
                        endsAt: range.end,
                      }));
                    }}
                    error={couponErrors.endsAt}
                  />

                  <Field label="Status">
                    <select
                      value={couponForm.status}
                      onChange={(e) => setCouponForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </Field>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveCoupon}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {saving ? "Saving…" : couponForm.id ? "Save Changes" : "Create Coupon"}
                    </button>
                    {couponForm.id ? (
                      <button
                        onClick={resetCouponForm}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Right: list */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Your Coupons</h3>
                  <Badge tone="slate">{visibleCoupons.length} total</Badge>
                </div>

                {visibleCoupons.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No coupons found.</p>
                ) : (
                  <ul className="mt-4 grid gap-3">
                    {visibleCoupons.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tracking-wide text-slate-900">
                                {c.code}
                              </span>
                              <Badge tone={c.status === "active" ? "green" : "amber"}>
                                {c.status === "active" ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                  </>
                                ) : (
                                  "Paused"
                                )}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">
                              {percentOrCurrency(c.discountType, c.discountValue)} •{" "}
                              {c.appliesTo === "all"
                                ? "All listings"
                                : `${Array.isArray(c.listingIds) ? c.listingIds.length : 0} selected`}
                              {" • "}
                              {fmtDateRange(c.startsAt, c.endsAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleCouponStatus(c)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              {c.status === "active" ? "Pause" : "Activate"}
                            </button>
                            <button
                              onClick={() => loadCouponForEdit(c)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setPendingDelete({ type: "coupon", id: c.id, label: c.code || "coupon" });
                                setConfirmOpen(true);
                              }}
                              disabled={deletingId === c.id}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deletingId === c.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!loading && activeTab === "promos" && (
            <div className="mt-6 grid lg:grid-cols-2 gap-6">
              {/* Left: composer */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Percent className="w-4 h-4" />
                    {promoForm.id ? "Edit Promo" : "Create Promo"}
                  </h3>
                  {promoForm.id ? <Badge tone="amber">Editing</Badge> : <Badge tone="blue">New</Badge>}
                </div>

                <div className="mt-4 grid gap-4">
                  <Field label="Title" error={promoErrors.title}>
                    <input
                      type="text"
                      placeholder="e.g., Summer Splash"
                      value={promoForm.title}
                      onChange={(e) => setPromoForm((p) => ({ ...p, title: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </Field>

                  <Field label="Description">
                    <textarea
                      rows={3}
                      placeholder="Optional description shown to guests."
                      value={promoForm.description}
                      onChange={(e) => setPromoForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    />
                  </Field>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Discount Type">
                      <select
                        value={promoForm.discountType}
                        onChange={(e) => setPromoForm((p) => ({ ...p, discountType: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (₱)</option>
                      </select>
                    </Field>
                    <Field label="Discount Value" error={promoErrors.discountValue}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={promoForm.discountValue}
                        onChange={(e) => setPromoForm((p) => ({ ...p, discountValue: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5"
                      />
                    </Field>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Applies To">
                      <select
                        value={promoForm.appliesTo}
                        onChange={(e) => setPromoForm((p) => ({ ...p, appliesTo: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5"
                      >
                        <option value="all">All listings</option>
                        <option value="selected">Specific listings</option>
                      </select>
                    </Field>
                    <Field label="Min. Subtotal (optional)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="₱"
                        value={promoForm.minSubtotal}
                        onChange={(e) => setPromoForm((p) => ({ ...p, minSubtotal: e.target.value }))}
                        className="w-full rounded-2xl border border-slate-300 bg-white/90 px-4 py-2.5"
                      />
                    </Field>
                  </div>

                  {promoForm.appliesTo === "selected" && (
                    <Field label="Select Listings" error={promoErrors.listingIds}>
                      <div className="grid gap-2 max-h-40 overflow-y-auto rounded-2xl border border-slate-200 p-2">
                        {listingOptions.length === 0 && (
                          <p className="text-xs text-slate-500 px-2">No listings found.</p>
                        )}
                        {listingOptions.map((opt) => {
                          const checked = promoForm.listingIds.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setPromoForm((p) => ({
                                    ...p,
                                    listingIds: toggleIdInList(p.listingIds, opt.id),
                                  }))
                                }
                              />
                              <span className="text-sm">{opt.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </Field>
                  )}

                  <CouponDateRangeField
                    label="Date Range"
                    value={{ start: promoForm.startsAt, end: promoForm.endsAt }}
                    onChange={(range) => {
                      setPromoForm((p) => ({
                        ...p,
                        startsAt: range.start,
                        endsAt: range.end,
                      }));
                    }}
                    error={promoErrors.endsAt}
                  />

                  <Field label="Status">
                    <select
                      value={promoForm.status}
                      onChange={(e) => setPromoForm((p) => ({ ...p, status: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-300 bg-white/90 px-3 py-2.5 text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </Field>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={savePromo}
                      disabled={savingPromo}
                      className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {savingPromo ? "Saving…" : promoForm.id ? "Save Changes" : "Create Promo"}
                    </button>
                    {promoForm.id ? (
                      <button
                        onClick={resetPromoForm}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Right: list */}
              <div className="rounded-3xl border border-slate-200 bg-white/90 backdrop-blur p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">Your Promos</h3>
                  <Badge tone="slate">{visiblePromos.length} total</Badge>
                </div>

                {visiblePromos.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No promos found.</p>
                ) : (
                  <ul className="mt-4 grid gap-3">
                    {visiblePromos.map((p) => (
                      <li
                        key={p.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold tracking-wide text-slate-900">{p.title}</span>
                              <Badge tone={p.status === "active" ? "green" : "amber"}>
                                {p.status === "active" ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                  </>
                                ) : (
                                  "Paused"
                                )}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">
                              {percentOrCurrency(p.discountType, p.discountValue)} •{" "}
                              {p.appliesTo === "all"
                                ? "All listings"
                                : `${Array.isArray(p.listingIds) ? p.listingIds.length : 0} selected`}
                              {" • "}
                              {fmtDateRange(p.startsAt, p.endsAt)}
                            </p>
                            {p.description ? <p className="text-xs text-slate-500 mt-1">{p.description}</p> : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => togglePromoStatus(p)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              {p.status === "active" ? "Pause" : "Activate"}
                            </button>
                            <button
                              onClick={() => loadPromoForEdit(p)}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setPendingDelete({ type: "promo", id: p.id, label: p.title || "promo" });
                                setConfirmOpen(true);
                              }}
                              disabled={deletingId === p.id}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              {deletingId === p.id ? "Deleting…" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Confirm Delete Modal */}
      <ConfirmDeleteModal
        open={confirmOpen}
        itemLabel={pendingDelete.label}
        busy={!!deletingId && pendingDelete.id === deletingId}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingDelete({ type: "", id: null, label: "" });
        }}
        onConfirm={confirmDelete}
      />
    </div>,
    document.body
  );
}
