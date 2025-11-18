import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Printer } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar.jsx";
import TailwindDropdown from "./components/TailwindDropdown.jsx";
import { database } from "../../config/firebase";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { collection, getDocs, query, where, documentId, orderBy, limit, startAfter } from "firebase/firestore";
import BookifyIcon from "../../media/favorite.png";
import { useSidebar } from "../../context/SidebarContext";
import DateRangeFilter from "./components/DateRangeFilter.jsx";
import PDFPreviewModal from "../../components/PDFPreviewModal.jsx";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

// Admin wallet ID constant
const ADMIN_WALLET_ID = "admin";

// small helpers
const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const peso = (v) => {
  const n = Number(v ?? 0);
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function formatPeso(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return null;
  return `₱${n.toLocaleString()}`;
}

function formatDate(dt) {
  if (!dt) return "—";
  const d = dt?.toDate ? dt.toDate() : new Date(dt);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTimeShort(dt) {
  if (!dt) return "—";
  const d = dt?.toDate ? dt.toDate() : new Date(dt);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCheckInDate(booking) {
  if (booking?.checkIn) return booking.checkIn;
  if (booking?.schedule?.date) {
    // schedule.date is a string like "2025-11-15", convert to Date
    return new Date(booking.schedule.date);
  }
  return null;
}

export default function AdminBookingsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar() || {};
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";
  const [bookings, setBookings] = useState([]);
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, confirmed, cancelled
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeFilter, setTimeFilter] = useState("all"); // all | today | week | month | year
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [pdfPreview, setPdfPreview] = useState({ open: false, htmlContent: "", filename: "" });

  // Load admin wallet transactions
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load admin wallet transactions (service fees)
        const tRef = collection(database, "wallets", ADMIN_WALLET_ID, "transactions");
        const tQuery = query(tRef, orderBy("timestamp", "desc"));
        const tSnap = await getDocs(tQuery);
        const transactions = tSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWalletTransactions(transactions);
        
        // Also load bookings for metrics
        const bookingsRef = collection(database, "bookings");
        const docs = await getDocs(bookingsRef);
        let rows = docs.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            guestName: v?.guestName || v?.guest?.name || "—",
            guestEmail: v?.guestEmail || v?.guest?.email || "—",
            listingTitle: v?.listing?.title || v?.listingTitle || "—",
            listingId: v?.listingId || null,
            checkIn: v?.checkIn,
            checkOut: v?.checkOut,
            category: null, // Will be populated from listing
            status: (v?.status || "pending").toLowerCase(),
            paymentStatus: (v?.paymentStatus || "pending").toLowerCase(),
            totalPrice: Number(v?.totalPrice || 0),
            guests: Number(v?.guests || 1),
            nights: Number(v?.nights || 0),
            notes: v?.notes || "",
            createdAt: v?.createdAt,
          };
        });

        // Optimize listing queries - use parallel queries
        const uniqueListingIds = [...new Set(rows.map((r) => r.listingId).filter(Boolean))];
        if (uniqueListingIds.length > 0) {
          const listingMap = {};
          const listingQueries = [];

          // Create parallel queries for chunks
          for (const chunk_ids of chunk(uniqueListingIds, 10)) {
            listingQueries.push(
              getDocs(
                query(collection(database, "listings"), where(documentId(), "in", chunk_ids))
              ).catch(() => ({ docs: [] })) // Return empty on error
            );
          }

          // Execute all queries in parallel
          const results = await Promise.all(listingQueries);
          
          // Process results
          results.forEach((listingDocs) => {
            listingDocs.docs.forEach((doc) => {
                const data = doc.data() || {};
                const rawCategory = data.category ?? data.listingCategory ?? null;
                const category =
                  typeof rawCategory === "string"
                    ? rawCategory
                    : rawCategory?.name ||
                      (data.experienceType ? "Experiences" : data.serviceType || data.type ? "Services" : "Homes");
                listingMap[doc.id] = {
                  title: data.title || "—",
                  category: category || "Uncategorized",
                };
              });
          });

          rows = rows.map((r) => {
            const listingData = listingMap[r.listingId];
            const isObject = listingData && typeof listingData === "object";
            return {
              ...r,
              listingTitle: isObject ? listingData.title : (listingData || r.listingTitle),
              category: isObject ? listingData.category : "Uncategorized",
            };
          });
        }

        setBookings(rows);
      } catch (e) {
        console.error("Failed to load bookings:", e);
        setBookings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Get unique categories from bookings (for filter)
  const categories = useMemo(() => {
    const cats = new Set();
    bookings.forEach((b) => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats).sort();
  }, [bookings]);

  // Helper to check if date is in range
  const isDateInRange = (date, range) => {
    if (!range.start && !range.end) return true;
    if (!date) return false;
    try {
      const d = date?.toDate ? date.toDate() : new Date(date);
      if (isNaN(d.getTime())) return false;
      
      if (range.start) {
        const startDate = new Date(range.start);
        startDate.setHours(0, 0, 0, 0);
        if (d < startDate) return false;
      }
      
      if (range.end) {
        const endDate = new Date(range.end);
        endDate.setHours(23, 59, 59, 999);
        if (d > endDate) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  // Helper function to get date range based on time filter
  const getTimeFilterRange = (filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case "today":
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case "week": {
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek);
        return { start: startOfWeek, end: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000) };
      }
      case "month": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { start: startOfMonth, end: endOfMonth };
      }
      case "year": {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        return { start: startOfYear, end: endOfYear };
      }
      default:
        return null; // "all" - no date filtering
    }
  };

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

  // SORTED & FILTERED - using bookings
  const sorted = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    const filtered = bookings.filter((b) => {
      // category filter
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      
      // time filter (takes precedence over dateRange if set)
      if (timeFilter !== "all") {
        const timeRange = getTimeFilterRange(timeFilter);
        if (timeRange) {
          const timestamp = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt));
          if (!timestamp || timestamp < timeRange.start || timestamp >= timeRange.end) return false;
        }
      } else {
        // date range filter (only if timeFilter is "all")
        if (!isDateInRange(b.createdAt, dateRange)) return false;
      }
      
      // status filter - filter by booking status (not payment status)
      if (statusFilter !== "all") {
        const bookingStatus = (b.status || "pending").toLowerCase();
        if (statusFilter === "confirmed" && bookingStatus !== "confirmed") return false;
        if (statusFilter === "pending" && bookingStatus !== "pending") return false;
        if (statusFilter === "cancelled" && bookingStatus !== "cancelled") return false;
      }
      
      // search filter
      if (s) {
        const hay = [
          b.id,
          b.guestName,
          b.guestEmail,
          b.listingTitle,
          b.category,
          b.status,
          b.paymentStatus,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(s);
      }
      return true;
    });

    const cmp = (a, b, key) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      if (key === "guestName" || key === "listingTitle" || key === "category" || key === "status" || key === "paymentStatus" || typeof va === "string")
        return String(va).localeCompare(String(vb));
      if (key === "createdAt" || key === "timestamp") {
        const ta = va?.toDate ? va.toDate().getTime() : (va instanceof Date ? va.getTime() : new Date(va).getTime());
        const tb = vb?.toDate ? vb.toDate().getTime() : (vb instanceof Date ? vb.getTime() : new Date(vb).getTime());
        return ta - tb;
      }
      return Number(va) - Number(vb);
    };

    let base = filtered;
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      return base.slice().sort((a, b) => dir * cmp(a, b, sortKey));
    }

    return base.slice().sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime());
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime());
      return tb - ta;
    });
  }, [bookings, search, sortKey, sortDir, statusFilter, categoryFilter, dateRange, timeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, categoryFilter, timeFilter, pageSize, sorted.length]);

  const pagedTransactions = sorted.slice((page - 1) * pageSize, page * pageSize);

  // METRICS
  const metrics = useMemo(() => {
    const total = bookings.length;
    const statusCounts = bookings.reduce((m, b) => {
      const s = b.status || "pending";
      m[s] = (m[s] || 0) + 1;
      return m;
    }, {});
    const paymentCounts = bookings.reduce((m, b) => {
      const p = b.paymentStatus || "pending";
      m[p] = (m[p] || 0) + 1;
      return m;
    }, {});

    const confirmed = statusCounts["confirmed"] || 0;
    const pending = statusCounts["pending"] || 0;
    const cancelled = statusCounts["cancelled"] || 0;

    const paid = paymentCounts["paid"] || 0;
    const unpaid = paymentCounts["pending"] || paymentCounts["unpaid"] || 0;

    const totalRevenue = bookings
      .filter((b) => b.paymentStatus === "paid")
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    const totalGuests = bookings.reduce((sum, b) => sum + (b.guests || 1), 0);
    const totalNights = bookings.reduce((sum, b) => sum + (b.nights || 0), 0);

    const topListing = bookings.reduce(
      (best, b) => {
        const count = bookings.filter((x) => x.listingTitle === b.listingTitle).length;
        return count > (best?.count || 0) ? { ...b, count } : best;
      },
      null
    );

    return {
      total,
      confirmed,
      pending,
      cancelled,
      paid,
      unpaid,
      totalRevenue,
      totalGuests,
      totalNights,
      topListing,
    };
  }, [bookings, walletTransactions]);

  // export CSV
  const exportCSV = () => {
    try {
      const rows = sorted || [];
      const headers = ["ID", "Guest", "Listing", "Category", "Date", "Amount", "Status", "Payment Status"];
      const lines = [headers.join(",")];
      for (const b of rows) {
        const bookingStatus = (b.status || "pending").toLowerCase();
        const paymentStatus = (b.paymentStatus || "pending").toLowerCase();
        const cols = [
          b.id || "",
          b.guestName || "",
          b.listingTitle || "",
          b.category || "",
          b.createdAt ? formatDateTimeShort(b.createdAt) : "",
          String(b.totalPrice || 0),
          bookingStatus,
          paymentStatus,
        ].map((c) => {
          if (c == null) return "";
          const s = String(c);
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        });
        lines.push(cols.join(","));
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timeFilterSuffix = timeFilter !== "all" ? `_${timeFilter}` : "";
      a.download = `bookings_export_${new Date().toISOString().slice(0, 10)}${timeFilterSuffix}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export CSV", e);
      alert("Failed to export CSV: " + String(e));
    }
  };

  // Generate HTML content for PDF
  const generatePDFHTML = () => {
    const rows = sorted || [];
    // Calculate metrics from filtered transactions
    const filteredMetrics = {
      total: rows.length,
      totalRevenue: rows.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
      confirmed: rows.filter((b) => (b.status || "pending").toLowerCase() === "confirmed").length,
      pending: rows.filter((b) => (b.status || "pending").toLowerCase() === "pending").length,
      cancelled: rows.filter((b) => (b.status || "pending").toLowerCase() === "cancelled").length,
      totalGuests: rows.reduce((sum, b) => sum + (b.guests || 1), 0),
    };

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
      return `₱${n.toLocaleString()}`;
    };

    const nowStr = new Date().toLocaleString();
    const timeFilterLabel = getTimeFilterLabel(timeFilter);

    const html = [];
    html.push(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Bookings Report</title>
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
    .dot.confirmed{ background:#10b981; }
    .dot.pending{ background:#f59e0b; }
    .dot.cancelled{ background:#ef4444; }

    .footer{ position:fixed; bottom:10mm; left:18mm; right:18mm; color:var(--muted); font-size:11px; display:flex; justify-content:space-between; }
    tfoot{ display: table-footer-group; }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Bookings Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Period: ${escapeHtml(timeFilterLabel)}<br/>
      Rows: ${rows.length.toLocaleString()}
    </div>
  </div>

  <div class="chips">
    <span class="chip"><span class="dot"></span><b>Total Bookings:</b> ${filteredMetrics.total.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Revenue:</b> ${formatPesoSafe(filteredMetrics.totalRevenue)}</span>
    <span class="chip"><span class="dot"></span><b>Confirmed:</b> ${filteredMetrics.confirmed.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Pending:</b> ${filteredMetrics.pending.toLocaleString()}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:10%;">ID</th>
        <th style="width:15%;">Guest</th>
        <th style="width:18%;">Listing</th>
        <th style="width:12%;">Category</th>
        <th style="width:12%;">Date</th>
        <th class="num" style="width:10%;">Amount</th>
        <th style="width:10%;">Status</th>
        <th style="width:13%;">Payment Status</th>
      </tr>
    </thead>
    <tbody>`);

    for (const b of rows) {
      const bookingStatus = (b.status || "pending").toLowerCase();
      const paymentStatus = (b.paymentStatus || "pending").toLowerCase();
      const statusClass = bookingStatus === "confirmed" ? "confirmed" : bookingStatus === "pending" ? "pending" : "cancelled";
      const category = b.category || "—";

      html.push(`<tr>
        <td class="mono">${escapeHtml(String(b.id).slice(0, 8))}…</td>
        <td>${escapeHtml(b.guestName || "—")}</td>
        <td>${escapeHtml(b.listingTitle || "—")}</td>
        <td>${escapeHtml(category)}</td>
        <td>${escapeHtml(b.createdAt ? formatDateTimeShort(b.createdAt) : "—")}</td>
        <td class="num">${escapeHtml(formatPesoSafe(b.totalPrice || 0))}</td>
        <td><span class="status"><span class="dot ${statusClass}"></span>${escapeHtml(bookingStatus)}</span></td>
        <td><span class="status"><span class="dot ${paymentStatus === "paid" ? "confirmed" : paymentStatus === "pending" ? "pending" : "cancelled"}"></span>${escapeHtml(paymentStatus)}</span></td>
      </tr>`);
    }

    html.push(`</tbody>
  </table>

  <div style="margin-top: 24px; padding: 16px; background: var(--subtle); border: 1px solid var(--line); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 14px; font-weight: 600; color: var(--ink);">Grand Total Revenue:</div>
    <div style="font-size: 18px; font-weight: 700; color: var(--brand);">${formatPesoSafe(filteredMetrics.totalRevenue)}</div>
  </div>

  <div class="footer">
    <div>Bookify • Bookings export</div>
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
      const filename = `bookings_export_${new Date().toISOString().slice(0, 10)}${timeFilterSuffix}.pdf`;
      setPdfPreview({ open: true, htmlContent, filename });
    } catch (e) {
      console.error("Failed to generate PDF preview", e);
      alert("Failed to generate PDF preview: " + String(e));
    }
  };

  // Print table
  const printTable = () => {
    try {
      const rows = sorted || [];
      // Calculate metrics from filtered bookings
      const filteredMetrics = {
        total: rows.length,
        totalRevenue: rows.reduce((sum, b) => sum + (b.totalPrice || 0), 0),
        confirmed: rows.filter((b) => (b.status || "pending").toLowerCase() === "confirmed").length,
        pending: rows.filter((b) => (b.status || "pending").toLowerCase() === "pending").length,
      };
      
      const escapeHtml = (str) => {
        if (str == null) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      const formatPeso = (v) => {
        const n = Number(v || 0);
        if (!Number.isFinite(n)) return "—";
        return `₱${n.toLocaleString()}`;
      };

      const nowStr = new Date().toLocaleString();
      const timeFilterLabel = getTimeFilterLabel(timeFilter);

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Bookings Report</title>
  <style>
    @page { margin: 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 12px/1.5 system-ui, -apple-system, sans-serif; color: #0f172a; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { width: 32px; height: 32px; border-radius: 6px; }
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
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Bookings Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Period: ${escapeHtml(timeFilterLabel)}<br/>
      Total: ${rows.length.toLocaleString()} bookings
    </div>
  </div>
  
  <div class="summary">
    <strong>Summary:</strong> ${filteredMetrics.total.toLocaleString()} total bookings, ${formatPeso(filteredMetrics.totalRevenue)} revenue, ${filteredMetrics.confirmed.toLocaleString()} confirmed
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Guest</th>
        <th>Listing</th>
        <th>Category</th>
        <th class="num">Guests</th>
        <th class="num">Total</th>
        <th>Status</th>
        <th>Payment Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((b) => {
        const category = b.category || "—";
        return `<tr>
          <td class="mono">${escapeHtml(String(b.id).slice(0, 8))}…</td>
          <td>${escapeHtml(b.guestName)}</td>
          <td>${escapeHtml(b.listingTitle)}</td>
          <td>${escapeHtml(category)}</td>
          <td class="num">${b.guests || 1}</td>
          <td class="num">${b.totalPrice != null ? escapeHtml(formatPeso(b.totalPrice)) : "—"}</td>
          <td>${escapeHtml(b.status)}</td>
          <td>${escapeHtml(b.paymentStatus)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="footer">
    Bookify • Bookings Report • Generated on ${escapeHtml(nowStr)}
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

  // Download PDF from preview
  const handleDownloadPDF = async () => {
    try {
      const htmlContent = generatePDFHTML();
      const filename = pdfPreview.filename;

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

  // UI helpers
  const statusBadgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "confirmed")
      return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800";
    if (s === "cancelled")
      return "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800";
    return "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800";
  };

  const paymentBadgeClass = (paymentStatus) => {
    const s = String(paymentStatus || "").toLowerCase();
    if (s === "paid")
      return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800";
    if (s === "cancelled" || s === "refunded")
      return "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800";
    return "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800";
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <AdminSidebar />
      {/* Content area wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ${sideOffset}`}>
        {/* Top bar — fixed */}
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
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Bookings</span>
              </div>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-3 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">

        {/* Report Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {/* Total Bookings */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Total Bookings</p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">{metrics.total}</p>
            <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                {metrics.confirmed} confirmed
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                {metrics.pending} pending
              </span>
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Total Revenue</p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
              {formatPeso(metrics.totalRevenue) || "—"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              From {metrics.paid} paid bookings
            </p>
          </div>

          {/* Guests & Nights */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Total Guests</p>
            <p className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900">
              {metrics.totalGuests.toLocaleString()}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {metrics.totalNights.toLocaleString()} total nights
            </p>
          </div>

          {/* Top Listing */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-semibold">Most Booked</p>
            <p className="mt-2 text-base sm:text-lg font-bold text-slate-900 truncate" title={metrics.topListing?.listingTitle}>
              {metrics.topListing?.listingTitle || "—"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {metrics.topListing?.count || 0} bookings
            </p>
          </div>
        </section>

        {/* Controls */}
        <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6 mb-6">
          <div className="flex flex-col gap-3">
          {/* First Row: Search and Category */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative" style={{ maxWidth: '280px', width: '100%' }}>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 1 0 3.89 9.39l3.61 3.6a1 1 0 0 0 1.42-1.42l-3.6-3.61A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0A4 4 0 0 1 5 9Z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                type="search"
                placeholder="Search bookings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-white/90 backdrop-blur text-base shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <TailwindDropdown
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: "all", label: "All Categories" },
                ...categories.map((cat) => ({ value: cat, label: cat })),
              ]}
              className="sm:min-w-[160px]"
            />
          </div>

          {/* Second Row: Time, Status, Sort & Export */}
            <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[200px]">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
            </div>
            <TailwindDropdown
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              options={[
                { value: "all", label: "All Time" },
                { value: "today", label: "Today" },
                { value: "week", label: "This Week" },
                { value: "month", label: "This Month" },
                { value: "year", label: "This Year" },
              ]}
              className="sm:min-w-[140px]"
            />
            <TailwindDropdown
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "confirmed", label: "Confirmed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              className="min-w-[130px]"
            />
            <TailwindDropdown
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              options={[
                { value: "timestamp", label: "Newest" },
                { value: "delta", label: "Amount" },
                { value: "type", label: "Type" },
              ]}
              className="min-w-[110px]"
            />
              <button
                title="Toggle sort direction"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm sm:text-base shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0 font-medium"
              >
                <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                  <path d="M6 4a1 1 0 0 1 1 1v8.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3A1 1 0 0 1 3.707 12.293L5 13.586V5a1 1 0 0 1 1-1Zm8 12a1 1 0 0 1-1-1V6.414l-1.293 1.293A1 1 0 0 1 10.293 6.293l3-3a1 1 0 0 1 1.414 0l3 3A1 1 0 0 1 16.293 7.707L15 6.414V15a1 1 0 0 1-1 1Z" />
                </svg>
                <span className="hidden xs:inline">{sortDir === "asc" ? "Asc" : "Desc"}</span>
              </button>
            <div className="flex items-center gap-2 ml-auto">
            <button
              title="Export CSV"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm sm:text-base font-semibold shadow hover:bg-indigo-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M3 3a2 2 0 0 0-2 2v5a1 1 0 1 0 2 0V5h14v10H7a1 1 0 1 0 0 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Z" />
                <path d="M10 14a1 1 0 0 1-1-1V7a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1Z" />
                <path d="M7.293 11.707a1 1 0 0 1 0-1.414l2-2a1 1 0 1 1 1.414 1.414L9.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414l-2-2Z" />
              </svg>
                <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              title="Export PDF"
              onClick={exportPDF}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm sm:text-base font-semibold shadow hover:bg-slate-800 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                <path d="M5 2a2 2 0 0 0-2 2v12l5-3 5 3 5-3V4a2 2 0 0 0-2-2H5Z" />
              </svg>
                <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              title="Print"
              onClick={printTable}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm sm:text-base font-semibold shadow hover:bg-emerald-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 whitespace-nowrap flex-shrink-0"
            >
              <Printer size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden xs:inline">Print</span>
            </button>
            </div>
          </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-slate-100 shadow-sm animate-pulse dark:bg-slate-800" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center shadow-sm dark:bg-slate-900/50 dark:border-slate-700">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 dark:bg-slate-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-4.35-4.35" />
                <circle cx="10" cy="10" r="7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No matching bookings</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-none rounded-2xl sm:-mx-3 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b-2 border-slate-300">
                    <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">ID</th>
                    <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Listing</th>
                    <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Category</th>
                    <th className="text-left py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="text-right py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Amount</th>
                    <th className="text-center py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="text-center py-4 px-4 text-sm sm:text-base font-bold text-slate-700 uppercase tracking-wider">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pagedTransactions.map((b, idx) => {
                    const bookingStatus = (b.status || "pending").toLowerCase();
                    const paymentStatus = (b.paymentStatus || "pending").toLowerCase();
                    const statusKind =
                      bookingStatus === "confirmed" ? "success" : bookingStatus === "pending" ? "warning" : "danger";
                    const paymentKind =
                      paymentStatus === "paid" ? "success" : paymentStatus === "pending" ? "warning" : "danger";
                    
                    return (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4">
                          <span className="font-mono text-xs sm:text-sm text-slate-600">
                            {b.id.slice(0, 8)}…
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm sm:text-base text-slate-900 font-medium">
                          {b.guestName || "—"}
                        </td>
                        <td className="py-4 px-4 text-sm sm:text-base text-slate-700">
                          {b.listingTitle || "—"}
                        </td>
                        <td className="py-4 px-4 text-sm sm:text-base text-slate-600">
                          {b.category || "—"}
                        </td>
                        <td className="py-4 px-4 text-sm sm:text-base text-slate-700 whitespace-nowrap font-medium">
                          {b.createdAt ? formatDateTimeShort(b.createdAt) : "—"}
                        </td>
                        <td className="py-4 px-4 text-right text-sm sm:text-base font-bold whitespace-nowrap text-slate-900">
                          {peso(b.totalPrice || 0)}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge kind={statusKind}>{bookingStatus}</Badge>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Badge kind={paymentKind}>{paymentStatus}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-4">
            <div className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Showing{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)}
              </span>{" "}
              of <span className="font-semibold text-slate-800 dark:text-slate-200">{sorted.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Rows:</label>
                <TailwindDropdown
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  options={[
                    { value: "10", label: "10" },
                    { value: "25", label: "25" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                  className="min-w-[80px]"
                />
              </div>
              <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0"
                >
                  <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                    <path d="M15.707 3.293a1 1 0 0 1 0 1.414L11.414 9l4.293 4.293a1 1 0 0 1-1.414 1.414l-5-5a1 1 0 0 1 0-1.414l5-5a1 1 0 0 1 1.414 0Z" />
                    <path d="M6.707 3.293a1 1 0 0 1 0 1.414L2.414 9l4.293 4.293a1 1 0 0 1-1.414 1.414l-5-5a1 1 0 0 1 0-1.414l5-5a1 1 0 0 1 1.414 0Z" />
                  </svg>
                  <span className="hidden sm:inline">First</span>
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0"
                >
                  <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                    <path d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0Z" />
                  </svg>
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                  Page {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0"
                >
                  <span className="hidden sm:inline">Next</span>
                  <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                    <path d="M7.293 14.707a1 1 0 0 1 0-1.414L10.586 10 7.293 6.707a1 1 0 0 1 1.414-1.414l4 4a1 1 0 0 1 0 1.414l-4 4a1 1 0 0 1-1.414 0Z" />
                  </svg>
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0"
                >
                  <span className="hidden sm:inline">Last</span>
                  <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                    <path d="M4.293 16.707a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0 0-1.414l-5-5a1 1 0 0 0-1.414 1.414L8.586 10l-4.293 4.293a1 1 0 0 0 0 1.414Z" />
                    <path d="M13.293 16.707a1 1 0 0 0 1.414 0l5-5a1 1 0 0 0 0-1.414l-5-5a1 1 0 0 0-1.414 1.414L17.586 10l-4.293 4.293a1 1 0 0 0 0 1.414Z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
          </div>
        </main>
      </div>

      <PDFPreviewModal
        open={pdfPreview.open}
        htmlContent={pdfPreview.htmlContent}
        filename={pdfPreview.filename}
        onClose={() => setPdfPreview({ open: false, htmlContent: "", filename: "" })}
        onDownload={handleDownloadPDF}
      />
    </div>
  );
}
