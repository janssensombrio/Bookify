import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar.jsx";
import { database } from "../../config/firebase";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { collection, getDocs, query, where, documentId } from "firebase/firestore";
import BookifyIcon from "../../media/favorite.png";
import { useSidebar } from "../../context/SidebarContext";

// small helpers
const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("all"); // all, pending, confirmed, cancelled
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
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

        // Try to batch-resolve listing titles and guest info
        const uniqueListingIds = [...new Set(rows.map((r) => r.listingId).filter(Boolean))];
        if (uniqueListingIds.length > 0) {
          const listingMap = {};
          for (const chunk_ids of chunk(uniqueListingIds)) {
            try {
              const listingDocs = await getDocs(
                query(collection(database, "listings"), where(documentId(), "in", chunk_ids))
              );
              listingDocs.forEach((doc) => {
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
            } catch (e) {
              console.warn("listings query failed", e);
            }
          }
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

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    bookings.forEach((b) => {
      if (b.category) cats.add(b.category);
    });
    return Array.from(cats).sort();
  }, [bookings]);

  // SORTED & FILTERED
  const sorted = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    const filtered = bookings.filter((b) => {
      // status filter
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      // category filter
      if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
      // search filter
      if (s) {
        const hay = [
          b.guestName,
          b.guestEmail,
          b.listingTitle,
          b.category,
          b.id,
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
      if (key === "guestName" || key === "listingTitle" || typeof va === "string")
        return String(va).localeCompare(String(vb));
      return Number(va) - Number(vb);
    };

    let base = filtered;
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      return base.slice().sort((a, b) => dir * cmp(a, b, sortKey));
    }

    return base.slice().sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt?.toDate?.()?.getTime?.() || 0;
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt?.toDate?.()?.getTime?.() || 0;
      return tb - ta;
    });
  }, [bookings, search, sortKey, sortDir, statusFilter, categoryFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, categoryFilter, pageSize, sorted.length]);

  const pagedBookings = sorted.slice((page - 1) * pageSize, page * pageSize);

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
  }, [bookings]);

  // export CSV
  const exportCSV = () => {
    try {
      const rows = sorted || [];
      const headers = ["ID", "Guest", "Email", "Listing", "Category", "Check-out", "Guests", "Nights", "Total", "Status", "Payment", "Created"];
      const lines = [headers.join(",")];
      for (const r of rows) {
        const category = r.category || "—";
        const cols = [
          r.id,
          (r.guestName || "").replace(/"/g, '""'),
          r.guestEmail || "",
          (r.listingTitle || "").replace(/"/g, '""'),
          category.replace(/"/g, '""'),
          formatDate(r.checkOut),
          r.guests || 1,
          r.nights || 0,
          r.totalPrice != null ? Number(r.totalPrice) : "",
          r.status || "",
          r.paymentStatus || "",
          r.createdAt ? new Date(r.createdAt?.toDate?.() || r.createdAt).toISOString() : "",
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
      a.download = `bookings_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export CSV", e);
      alert("Failed to export CSV: " + String(e));
    }
  };

  // export PDF via download
  const exportPDF = async () => {
    try {
      const rows = sorted || [];

      const escapeHtml = (str) => {
        if (str == null) return "";
        return String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      const nowStr = new Date().toLocaleString();

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
    body{ margin:0; font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }

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
      Rows: ${rows.length.toLocaleString()}
    </div>
  </div>

  <div class="chips">
    <span class="chip"><span class="dot"></span><b>Total Bookings:</b> ${metrics.total.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Revenue:</b> ${formatPeso(metrics.totalRevenue)}</span>
    <span class="chip"><span class="dot"></span><b>Confirmed:</b> ${metrics.confirmed.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Guests:</b> ${metrics.totalGuests.toLocaleString()}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:12%;">ID</th>
        <th style="width:15%;">Guest</th>
        <th style="width:18%;">Listing</th>
        <th style="width:12%;">Category</th>
        <th class="num" style="width:10%;">Guests</th>
        <th class="num" style="width:10%;">Total</th>
        <th style="width:11%;">Status</th>
        <th style="width:12%;">Payment</th>
      </tr>
    </thead>
    <tbody>`);

    for (const b of rows) {
      const category = b.category || "—";
      const statusClass = b.status === "confirmed" ? "confirmed" : b.status === "pending" ? "pending" : "cancelled";
      const paymentClass = b.paymentStatus === "paid" ? "confirmed" : b.paymentStatus === "cancelled" ? "cancelled" : "pending";

      html.push(`<tr>
        <td class="mono">${escapeHtml(String(b.id).slice(0, 8))}…</td>
        <td>${escapeHtml(b.guestName)}</td>
        <td>${escapeHtml(b.listingTitle)}</td>
        <td>${escapeHtml(category)}</td>
        <td class="num">${b.guests || 1}</td>
        <td class="num">${b.totalPrice != null ? escapeHtml(formatPeso(b.totalPrice)) : "—"}</td>
        <td><span class="status"><span class="dot ${statusClass}"></span>${escapeHtml(b.status)}</span></td>
        <td><span class="status"><span class="dot ${paymentClass}"></span>${escapeHtml(b.paymentStatus)}</span></td>
      </tr>`);
    }

    html.push(`</tbody>
  </table>

  <div class="footer">
    <div>Bookify • Bookings export</div>
    <div>Page <span class="page-num"></span></div>
  </div>

</body>
</html>`);

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

    try {
      const html2pdf = await loadHtml2Pdf();
      const element = document.createElement("div");
      element.innerHTML = html.join("");
      document.body.appendChild(element);

      const opt = {
        margin: [18, 18],
        filename: `bookings_export_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      };

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
    } catch (err) {
      // Fallback to print dialog if library fails
      const win = window.open("", "_blank");
      if (!win) {
        alert("Unable to open print window. Please allow popups for this site.");
        return;
      }
      win.document.open();
      win.document.write(html.join(""));
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    }
    } catch (e) {
      console.error("Failed to export PDF", e);
      alert("Failed to export PDF: " + String(e));
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
          <div className="max-w-[1400px] mx-auto flex items-center justify-between px-3 sm:px-4 md:px-8 py-2.5 sm:py-3">
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
        <main className="flex-1 p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">

        {/* Report Summary */}
        <section className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-3">
          {/* Total Bookings */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.total}</p>
            <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {metrics.confirmed} confirmed
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {metrics.pending} pending
              </span>
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">Total Revenue</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {formatPeso(metrics.totalRevenue) || "—"}
            </p>
            <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500">
              From {metrics.paid} paid bookings
            </p>
          </div>

          {/* Guests & Nights */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {metrics.totalGuests.toLocaleString()}
            </p>
            <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500">
              {metrics.totalNights.toLocaleString()} total nights
            </p>
          </div>

          {/* Top Listing */}
          <div className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">Most Booked</p>
            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={metrics.topListing?.listingTitle}>
              {metrics.topListing?.listingTitle || "—"}
            </p>
            <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-500">
              {metrics.topListing?.count || 0} bookings
            </p>
          </div>
        </section>

        {/* Controls */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Search and Category Filter */}
          <div className="lg:col-span-1 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
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
                placeholder="Search by guest, email, listing or booking ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 backdrop-blur text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 backdrop-blur text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100 sm:min-w-[160px]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Sort & Filters */}
          <div className="lg:col-span-1 flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Filter:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 sm:px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 min-w-0 flex-shrink"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Sort by:</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="px-2 sm:px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 min-w-0 flex-shrink"
              >
                <option value="createdAt">Newest</option>
                <option value="totalPrice">Price</option>
                <option value="guestName">Guest</option>
                <option value="listingTitle">Listing</option>
              </select>
              <button
                title="Toggle sort direction"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1 px-2 sm:px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 whitespace-nowrap flex-shrink-0"
              >
                <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                  <path d="M6 4a1 1 0 0 1 1 1v8.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3A1 1 0 0 1 3.707 12.293L5 13.586V5a1 1 0 0 1 1-1Zm8 12a1 1 0 0 1-1-1V6.414l-1.293 1.293A1 1 0 0 1 10.293 6.293l3-3a1 1 0 0 1 1.414 0l3 3A1 1 0 0 1 16.293 7.707L15 6.414V15a1 1 0 0 1-1 1Z" />
                </svg>
                <span className="hidden xs:inline">{sortDir === "asc" ? "Asc" : "Desc"}</span>
              </button>
            </div>
            <button
              title="Export CSV"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-medium shadow hover:bg-indigo-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M3 3a2 2 0 0 0-2 2v5a1 1 0 1 0 2 0V5h14v10H7a1 1 0 1 0 0 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Z" />
                <path d="M10 14a1 1 0 0 1-1-1V7a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1Z" />
                <path d="M7.293 11.707a1 1 0 0 1 0-1.414l2-2a1 1 0 1 1 1.414 1.414L9.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414l-2-2Z" />
              </svg>
              Export CSV
            </button>
            <button
              title="Export PDF"
              onClick={exportPDF}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium shadow hover:bg-slate-800 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 whitespace-nowrap flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                <path d="M5 2a2 2 0 0 0-2 2v12l5-3 5 3 5-3V4a2 2 0 0 0-2-2H5Z" />
              </svg>
              <span className="hidden xs:inline">Export PDF</span><span className="xs:hidden">PDF</span>
            </button>
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
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-slate-900/80">
                  <tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 pl-4 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm">ID</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm">Guest</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden sm:table-cell">Listing</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden md:table-cell">Category</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm text-right hidden lg:table-cell">Guests</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm text-right">Total</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm">Status</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden md:table-cell">Payment</th>
                    <th className="py-3 pr-4 font-semibold text-xs sm:text-sm hidden lg:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedBookings.map((b, idx) => (
                    <tr
                      key={b.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 ${
                        idx % 2 === 0 ? "bg-white/70 dark:bg-slate-900/40" : "bg-white/40 dark:bg-slate-900/30"
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 sm:pr-4 font-mono text-xs text-slate-500">{String(b.id).slice(0, 8)}…</td>
                      <td className="py-3 pr-2 sm:pr-4 font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{b.guestName}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm hidden sm:table-cell">{b.listingTitle}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm hidden md:table-cell">{b.category || "—"}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-right text-slate-900 dark:text-slate-100 text-xs sm:text-sm hidden lg:table-cell">{b.guests || 1}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-right text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                        {b.totalPrice != null ? formatPeso(b.totalPrice) : "—"}
                      </td>
                      <td className="py-3 pr-2 sm:pr-4 text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${statusBadgeClass(b.status)}`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              b.status?.toLowerCase() === "confirmed"
                                ? "bg-emerald-500"
                                : b.status?.toLowerCase() === "cancelled"
                                ? "bg-red-500"
                                : "bg-amber-500"
                            }`}
                          ></span>
                          {b.status || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-2 sm:pr-4 text-xs hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${paymentBadgeClass(b.paymentStatus)}`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              b.paymentStatus?.toLowerCase() === "paid"
                                ? "bg-emerald-500"
                                : b.paymentStatus?.toLowerCase() === "cancelled" ||
                                  b.paymentStatus?.toLowerCase() === "refunded"
                                ? "bg-red-500"
                                : "bg-amber-500"
                            }`}
                          ></span>
                          {b.paymentStatus || "—"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500 hidden lg:table-cell">{formatDateTimeShort(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {sorted.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-4">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Showing{" "}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)}
              </span>{" "}
              of <span className="font-medium text-slate-800 dark:text-slate-200">{sorted.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Rows:</label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 min-w-0 flex-shrink"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
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
        </main>
      </div>
    </div>
  );
}
