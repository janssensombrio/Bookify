import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./components/AdminSidebar.jsx";
import TailwindDropdown from "./components/TailwindDropdown.jsx";
import BookifyLogo from "../../components/bookify-logo.jsx";
import DateRangeFilter from "./components/DateRangeFilter.jsx";
import { database } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Menu, Printer } from "lucide-react";
import BookifyIcon from "../../media/favorite.png";
import { useSidebar } from "../../context/SidebarContext";
import PDFPreviewModal from "../../components/PDFPreviewModal.jsx";

const chunk = (arr, size = 10) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

function formatDate(dt) {
  if (!dt) return "—";
  const d = dt?.toDate ? dt.toDate() : new Date(dt);
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}


export default function AdminGuestsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar() || {};
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [pdfPreview, setPdfPreview] = useState({ open: false, htmlContent: "", filename: "" });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const usersRef = collection(database, "users");
        const docsSnap = await getDocs(usersRef);
        let rows = docsSnap.docs
          .map((d) => {
            const v = d.data() || {};
            return {
              id: d.id,
              uid: v?.uid || v?.userId || d.id,
              firstName: v?.firstName || (v?.displayName ? String(v.displayName).split(" ")[0] : ""),
              lastName: v?.lastName || (v?.displayName ? String(v.displayName).split(" ").slice(1).join(" ") : ""),
              email: v?.email || "—",
              verified: v?.verified === true || String(v?.verified || "").toLowerCase() === "true",
              createdAt: v?.createdAt || v?.created || null,
              lastLogin: v?.lastLogin || null,
              photoURL: v?.photoURL || null,
              role: (v?.role || v?.type || "").toLowerCase(),
            };
          })
          .filter((r) => {
            const role = String(r.role || "").toLowerCase();
            if (role === "guest") return true;
            if (!role) return true;
            return role !== "admin" && role !== "host";
          });

        // Optimize booking queries - use parallel queries for multiple field names
        const uniqueUIDs = [...new Set(rows.map((r) => r.uid).filter(Boolean))];
        const bookingCountMap = {};
        const totalSpentMap = {};
        if (uniqueUIDs.length > 0) {
          const seenBookingIds = new Set();
          const bookingQueries = [];

          // Create parallel queries for chunks using multiple field names (uid, userId, guestUid)
          for (const chunk_ids of chunk(uniqueUIDs, 10)) {
            // Query by uid (most common)
            bookingQueries.push(
              getDocs(query(collection(database, "bookings"), where("uid", "in", chunk_ids)))
                .catch(() => ({ docs: [] }))
            );
            // Query by userId (also common)
            bookingQueries.push(
              getDocs(query(collection(database, "bookings"), where("userId", "in", chunk_ids)))
                .catch(() => ({ docs: [] }))
            );
            // Query by guestUid (less common but some bookings might use it)
            bookingQueries.push(
              getDocs(query(collection(database, "bookings"), where("guestUid", "in", chunk_ids)))
                .catch(() => ({ docs: [] }))
            );
          }

          // Execute all queries in parallel
          const results = await Promise.all(bookingQueries);
          
          // Process results - deduplicate by booking ID
          results.forEach((snap) => {
            snap.docs.forEach((doc) => {
                  if (seenBookingIds.has(doc.id)) return;
                  seenBookingIds.add(doc.id);
                  const data = doc.data() || {};
              // Try multiple field names to find the guest UID
              const guestUid = data.uid || data.userId || data.guestUid || data.guestId || null;
              if (guestUid) {
                bookingCountMap[guestUid] = (bookingCountMap[guestUid] || 0) + 1;
                const totalPrice = Number(data.totalPrice || 0);
                totalSpentMap[guestUid] = (totalSpentMap[guestUid] || 0) + totalPrice;
              }
            });
          });

          rows = rows.map((r) => ({ 
            ...r, 
            bookingCount: bookingCountMap[r.uid] || 0,
            totalSpent: totalSpentMap[r.uid] || 0
          }));
        }

        setGuests(rows);
      } catch (e) {
        console.error("Failed to load guests:", e);
        setGuests([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  const sorted = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    const filtered = guests.filter((g) => {
      if (verifiedFilter !== "all" && g.verified !== (verifiedFilter === "verified")) return false;
      if (!isDateInRange(g.createdAt, dateRange)) return false;
      if (s) {
        const hay = [g.firstName, g.lastName, g.email, g.id].filter(Boolean).join(" ").toLowerCase();
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
      if (typeof va === "string") return String(va).localeCompare(String(vb));
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
  }, [guests, search, sortKey, sortDir, verifiedFilter, dateRange]);

  const metrics = useMemo(() => {
    const nonAdmin = guests.filter((g) => String(g.role || "").toLowerCase() !== "admin");
    const total = nonAdmin.length;
    const verified = nonAdmin.filter((g) => g.verified).length;
    const unverified = total - verified;
    const totalBookings = nonAdmin.reduce((sum, g) => sum + (g.bookingCount || 0), 0);
    const avgBookingsPerGuest = total ? (totalBookings / total).toFixed(2) : 0;
    const mostActive = nonAdmin.reduce((best, g) => (g.bookingCount || 0) > (best?.bookingCount || 0) ? g : best, null);
    return { total, verified, unverified, totalBookings, avgBookingsPerGuest, mostActive };
  }, [guests]);

  const exportCSV = () => {
    try {
      const rows = sorted || [];
      const headers = ["ID", "First Name", "Last Name", "Email", "Bookings", "Total Spent", "Verified", "Created", "Last Login"];
      const lines = [headers.join(",")];
      for (const r of rows) {
        const cols = [
          r.id,
          (r.firstName || "").replace(/"/g, '""'),
          (r.lastName || "").replace(/"/g, '""'),
          r.email || "",
          r.bookingCount || 0,
          r.totalSpent || 0,
          r.verified ? "Yes" : "No",
          r.createdAt ? new Date(r.createdAt?.toDate?.() || r.createdAt).toISOString() : "",
          r.lastLogin ? new Date(r.lastLogin?.toDate?.() || r.lastLogin).toISOString() : "",
        ].map((c) => {
          if (c == null) return "";
          const s = String(c);
          return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
        });
        lines.push(cols.join(","));
      }
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guests_export_${new Date().toISOString().slice(0, 10)}.csv`;
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
    const escapeHtml = (str) => {
      if (str == null) return "";
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };
    const nowStr = new Date().toLocaleString();
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Guests Report</title>
  <style>
    :root { --brand:#2563eb; --ink:#0f172a; --muted:#64748b; --line:#e5e7eb; --bg:#ffffff; }
    @page { margin: 18mm; }
    body { margin:0; padding:20px; font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
    .header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--line); }
    .brand { display:flex; align-items:center; gap:12px; }
    .brand img { width:28px; height:28px; border-radius:6px; object-fit:cover; }
    .brand h1 { font-size:16px; line-height:1.1; margin:0; }
    .brand small { color:var(--muted); display:block; font-weight:500; }
    .meta { text-align:right; color:var(--muted); font-size:11px; }
    table { width:100%; border-collapse:collapse; border:1px solid var(--line); border-radius:8px; }
    thead { background:#f8fafc; }
    thead th { text-align:left; padding:10px 12px; font-size:11px; color:#334155; border-bottom:1px solid var(--line); font-weight:600; }
    tbody td { padding:10px 12px; border-bottom:1px solid var(--line); background:#fff; }
    tbody tr:nth-child(even) td { background:#fbfdff; }
    .mono { font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:11px; color:#475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand"><img src="${BookifyIcon}" alt="logo"/><h1>Bookify <small>Guests Report</small></h1></div>
    <div class="meta">Generated: ${escapeHtml(nowStr)}<br/>Rows: ${rows.length.toLocaleString()}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:10%">ID</th>
        <th style="width:18%">Name</th>
        <th style="width:22%">Email</th>
        <th style="width:8%">Bookings</th>
        <th style="width:12%">Total Spent</th>
        <th style="width:12%">Status</th>
        <th style="width:18%">Joined</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((g) => {
        const fullName = [g.firstName, g.lastName].filter(Boolean).join(" ") || "—";
        const verifiedText = g.verified ? "Verified" : "Unverified";
        const totalSpent = `₱${(g.totalSpent || 0).toLocaleString()}`;
        return `<tr>
          <td class="mono">${escapeHtml(String(g.id).slice(0, 8))}…</td>
          <td>${escapeHtml(fullName)}</td>
          <td>${escapeHtml(g.email)}</td>
          <td>${g.bookingCount || 0}</td>
          <td>${escapeHtml(totalSpent)}</td>
          <td>${verifiedText}</td>
          <td>${formatDate(g.createdAt)}</td>
        </tr>`;
      }).join("")}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 600;">
        <td colspan="3" style="text-align: right; padding: 12px;">Total:</td>
        <td style="padding: 12px; text-align: center;">${rows.reduce((sum, g) => sum + (g.bookingCount || 0), 0).toLocaleString()}</td>
        <td style="padding: 12px;">₱${rows.reduce((sum, g) => sum + (g.totalSpent || 0), 0).toLocaleString()}</td>
        <td colspan="2"></td>
      </tr>
    </tfoot>
  </table>
  <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 13px; font-weight: 600; color: #0f172a;">Total Guests:</div>
    <div style="font-size: 16px; font-weight: 700; color: #2563eb;">${rows.length.toLocaleString()}</div>
  </div>
</body>
</html>`;
  };

  // export PDF via preview
  const exportPDF = () => {
    try {
      const htmlContent = generatePDFHTML();
      const filename = `guests_export_${new Date().toISOString().slice(0, 10)}.pdf`;
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
      const escapeHtml = (str) => {
        if (str == null) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      };
      const nowStr = new Date().toLocaleString();

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Guests Report</title>
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
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    thead { background: #f1f5f9; }
    th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; color: #334155; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    tr:nth-child(even) { background: #f8fafc; }
    .mono { font-family: ui-monospace, monospace; font-size: 10px; color: #475569; }
    .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Guests Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Total: ${rows.length.toLocaleString()} guests
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
        <th>Bookings</th>
        <th>Total Spent</th>
        <th>Status</th>
        <th>Joined</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((g) => {
        const fullName = [g.firstName, g.lastName].filter(Boolean).join(" ") || "—";
        const verifiedText = g.verified ? "Verified" : "Unverified";
        const totalSpent = `₱${(g.totalSpent || 0).toLocaleString()}`;
        return `<tr>
          <td class="mono">${escapeHtml(String(g.id).slice(0, 8))}…</td>
          <td>${escapeHtml(fullName)}</td>
          <td>${escapeHtml(g.email)}</td>
          <td>${g.bookingCount || 0}</td>
          <td>${escapeHtml(totalSpent)}</td>
          <td>${verifiedText}</td>
          <td>${formatDate(g.createdAt)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="footer">
    Bookify • Guests Report • Generated on ${escapeHtml(nowStr)}
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

  const verificationBadgeClass = (verified) =>
    verified
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200"
      : "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200";

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
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Guests</span>
              </div>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-3 sm:px-6 md:px-28 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8 overflow-y-auto">

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total}</p>
            <div className="mt-2 sm:mt-3 flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{metrics.verified} verified</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700">{metrics.unverified} unverified</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{metrics.totalBookings.toLocaleString()}</p>
            <p className="mt-2 text-xs text-slate-600">Average: {metrics.avgBookingsPerGuest} per guest</p>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Most Active Guest</p>
            <p className="mt-1 text-sm sm:text-base font-semibold text-slate-900 truncate" title={metrics.mostActive ? `${metrics.mostActive.firstName} ${metrics.mostActive.lastName}` : "—"}>
              {metrics.mostActive ? `${metrics.mostActive.firstName} ${metrics.mostActive.lastName}` : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-600">{metrics.mostActive?.bookingCount || 0} bookings</p>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Verification Rate</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total ? `${Math.round((metrics.verified / metrics.total) * 100)}%` : "—"}</p>
            <div className="mt-2 sm:mt-3 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${metrics.total ? (metrics.verified / metrics.total) * 100 : 0}%` }} />
            </div>
          </div>
        </section>

        {/* Controls */}
        <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="lg:col-span-1">
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 3.5a5.5 5.5 0 1 0 3.89 9.39l3.61 3.6a1 1 0 0 0 1.42-1.42l-3.6-3.61A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0A4 4 0 0 1 5 9Z" />
              </svg>
              <input
                type="search"
                placeholder="Search by name, email or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <div className="min-w-[200px]">
              <DateRangeFilter
                value={dateRange}
                onChange={setDateRange}
                placeholder="Select date range"
              />
            </div>
            <TailwindDropdown
                value={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.value)}
              options={[
                { value: "all", label: "All Guests" },
                { value: "verified", label: "Verified Only" },
                { value: "unverified", label: "Unverified Only" },
              ]}
              className="min-w-[140px]"
            />
            <TailwindDropdown
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              options={[
                { value: "createdAt", label: "Newest" },
                { value: "firstName", label: "First Name" },
                { value: "email", label: "Email" },
                { value: "bookingCount", label: "Bookings" },
                { value: "totalSpent", label: "Total Spent" },
              ]}
              className="min-w-[130px]"
            />
              <button
                title="Toggle sort direction"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            <button
              title="Export CSV"
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Export CSV
            </button>
            <button
              title="Export PDF"
              onClick={exportPDF}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium shadow hover:bg-slate-800 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              Export PDF
            </button>
            <button
              title="Print"
              onClick={printTable}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow hover:bg-emerald-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Printer size={16} />
              Print
            </button>
          </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-100 shadow-sm animate-pulse dark:bg-slate-800" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center shadow-sm dark:bg-slate-900/50 dark:border-slate-700">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 dark:bg-slate-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-4.35-4.35" />
                <circle cx="10" cy="10" r="7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No matching guests</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <div className="overflow-x-auto rounded-2xl">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-slate-900/80">
                  <tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 pl-4 pr-4 font-semibold">ID</th>
                    <th className="py-3 pr-4 font-semibold">First Name</th>
                    <th className="py-3 pr-4 font-semibold">Last Name</th>
                    <th className="py-3 pr-4 font-semibold">Email</th>
                    <th className="py-3 pr-4 font-semibold text-right">Bookings</th>
                    <th className="py-3 pr-4 font-semibold text-right">Total Spent</th>
                    <th className="py-3 pr-4 font-semibold">Status</th>
                    <th className="py-3 pr-4 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((g, idx) => (
                    <tr
                      key={g.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 ${
                        idx % 2 === 0 ? "bg-white/70 dark:bg-slate-900/40" : "bg-white/40 dark:bg-slate-900/30"
                      }`}
                    >
                      <td className="py-3 pl-4 pr-4 font-mono text-xs text-slate-500">{String(g.id).slice(0, 8)}…</td>
                      <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">{g.firstName || "—"}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{g.lastName || "—"}</td>
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-200">{g.email}</td>
                      <td className="py-3 pr-4 text-right text-slate-900 dark:text-slate-100">{g.bookingCount || 0}</td>
                      <td className="py-3 pr-4 text-right text-slate-900 dark:text-slate-100 font-medium">₱{(g.totalSpent || 0).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${verificationBadgeClass(g.verified)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${g.verified ? "bg-emerald-500" : "bg-red-500"}`} />
                          {g.verified ? "Verified" : "Unverified"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{formatDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
