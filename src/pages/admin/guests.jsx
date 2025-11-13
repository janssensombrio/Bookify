import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./components/AdminSidebar.jsx";
import { database } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import BookifyIcon from "../../media/favorite.png";

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
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [verifiedFilter, setVerifiedFilter] = useState("all");

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

        const uniqueUIDs = [...new Set(rows.map((r) => r.uid).filter(Boolean))];
        const bookingCountMap = {};
        if (uniqueUIDs.length > 0) {
          const guestFields = ["guestUid", "uid", "guestId", "guest.uid", "guest.id"];
          const seenBookingIds = new Set();

          for (const chunk_ids of chunk(uniqueUIDs, 10)) {
            for (const f of guestFields) {
              try {
                const snaps = await getDocs(query(collection(database, "bookings"), where(f, "in", chunk_ids)));
                snaps.forEach((doc) => {
                  if (seenBookingIds.has(doc.id)) return;
                  seenBookingIds.add(doc.id);
                  const data = doc.data() || {};
                  const guestUid = data.guestUid || data.uid || data.guestId || (data.guest && (data.guest.uid || data.guest.id)) || null;
                  if (guestUid) bookingCountMap[guestUid] = (bookingCountMap[guestUid] || 0) + 1;
                });
              } catch (e) {
                console.warn(`bookings query for field ${f} failed:`, e);
              }
            }
          }

          rows = rows.map((r) => ({ ...r, bookingCount: bookingCountMap[r.uid] || 0 }));
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

  const sorted = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    const filtered = guests.filter((g) => {
      if (verifiedFilter !== "all" && g.verified !== (verifiedFilter === "verified")) return false;
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
  }, [guests, search, sortKey, sortDir, verifiedFilter]);

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
      const headers = ["ID", "First Name", "Last Name", "Email", "Bookings", "Verified", "Created", "Last Login"];
      const lines = [headers.join(",")];
      for (const r of rows) {
        const cols = [
          r.id,
          (r.firstName || "").replace(/"/g, '""'),
          (r.lastName || "").replace(/"/g, '""'),
          r.email || "",
          r.bookingCount || 0,
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

  const exportPDF = () => {
    try {
      const rows = sorted || [];
      const escapeHtml = (str) => {
        if (str == null) return "";
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      };
      const nowStr = new Date().toLocaleString();
      const htmlContent = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Guests Report</title>
  <style>
    :root { --brand:#2563eb; --ink:#0f172a; --muted:#64748b; --line:#e5e7eb; --bg:#ffffff; }
    @page { margin: 18mm; }
    body { margin:0; font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
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
        <th style="width:12%">ID</th>
        <th style="width:20%">Name</th>
        <th style="width:28%">Email</th>
        <th style="width:10%">Bookings</th>
        <th style="width:15%">Status</th>
        <th style="width:15%">Joined</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((g) => {
        const fullName = [g.firstName, g.lastName].filter(Boolean).join(" ") || "—";
        const verifiedText = g.verified ? "Verified" : "Unverified";
        return `<tr>
          <td class="mono">${escapeHtml(String(g.id).slice(0, 8))}…</td>
          <td>${escapeHtml(fullName)}</td>
          <td>${escapeHtml(g.email)}</td>
          <td>${g.bookingCount || 0}</td>
          <td>${verifiedText}</td>
          <td>${formatDate(g.createdAt)}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</body>
</html>`;
      const win = window.open("", "_blank");
      if (!win) {
        alert("Unable to open print window. Please allow popups for this site.");
        return;
      }
      win.document.open();
      win.document.write(htmlContent);
      win.document.close();
      setTimeout(() => {
        win.focus();
        win.print();
      }, 500);
    } catch (e) {
      console.error("Failed to export PDF", e);
      alert("Failed to export PDF: " + String(e));
    }
  };

  const verificationBadgeClass = (verified) =>
    verified
      ? "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200"
      : "bg-red-100 text-red-700 ring-1 ring-inset ring-red-200";

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <AdminSidebar />
      <main className="flex-1 p-6 sm:p-8 max-w-[1400px] mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Guests</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">View and manage all registered guest accounts.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/admin-dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium shadow-sm hover:bg-slate-50 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path d="M11.707 15.707a1 1 0 0 1-1.414 0l-5-5a1 1 0 0 1 0-1.414l5-5A1 1 0 1 1 11.707 5.293L8.414 8.586H17a1 1 0 1 1 0 2H8.414l3.293 3.293a1 1 0 0 1 0 1.414z" />
              </svg>
              Back
            </button>
          </div>
        </div>

        <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Guests</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.total}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{metrics.verified} verified</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{metrics.unverified} unverified</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.totalBookings.toLocaleString()}</p>
            <p className="mt-2 text-xs text-slate-500">Average: {metrics.avgBookingsPerGuest} per guest</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Most Active Guest</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={metrics.mostActive ? `${metrics.mostActive.firstName} ${metrics.mostActive.lastName}` : "—"}>
              {metrics.mostActive ? `${metrics.mostActive.firstName} ${metrics.mostActive.lastName}` : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">{metrics.mostActive?.bookingCount || 0} bookings</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <p className="text-xs uppercase tracking-wide text-slate-500">Verification Rate</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{metrics.total ? `${Math.round((metrics.verified / metrics.total) * 100)}%` : "—"}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${metrics.total ? (metrics.verified / metrics.total) * 100 : 0}%` }} />
            </div>
          </div>
        </section>

        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 backdrop-blur text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">Filter:</label>
              <select
                value={verifiedFilter}
                onChange={(e) => setVerifiedFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="all">All Guests</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600 dark:text-slate-400">Sort by:</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="createdAt">Newest</option>
                <option value="firstName">First Name</option>
                <option value="email">Email</option>
                <option value="bookingCount">Bookings</option>
              </select>
              <button
                title="Toggle sort direction"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
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
      </main>
    </div>
  );
}
