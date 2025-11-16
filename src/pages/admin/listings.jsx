import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import AdminSidebar from "./components/AdminSidebar.jsx";
import TailwindDropdown from "./components/TailwindDropdown.jsx";
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

const extractListingIdFromPath = (path) => {
  if (!path) return null;
  const parts = String(path).split("/").filter(Boolean);
  const i = parts.indexOf("listings");
  return i >= 0 && parts[i + 1] ? parts[i + 1] : null;
};

const getListingIdFromBooking = (b) =>
  b?.listingId || extractListingIdFromPath(b?.listingRefPath) || b?.listing?.id || null;

function formatPeso(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return null;
  return `₱${n.toLocaleString()}`;
}

// Optional: card layout retained for future use
// function ListingCard({ item }) {
//   const img = item.photos?.[0] || item.cover || null;
//   const subtitle = item.location || item.municipality?.name || item.province?.name || "Location";
//   const priceText = formatPeso(item.price);
//   return (
//     <div className="group">
//       <div className="relative rounded-[28px] overflow-hidden bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow transition-all duration-300 hover:-translate-y-1.5 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700">
//         <div className="relative h-48 sm:h-56 md:h-60 overflow-hidden">
//           {img ? (
//             <img src={img} alt={item.title || "Listing image"} className="absolute inset-0 w-full h-full object-cover" />
//           ) : (
//             <div className="absolute inset-0 grid place-items-center text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400">No photo</div>
//           )}
//           <div className="absolute top-3 left-3 text-[11px] px-2 py-1 rounded-full backdrop-blur bg-white/70 border border-white/80 shadow dark:bg-slate-900/70 dark:border-slate-800">
//             <span className={item.status === "published" ? "text-green-700 dark:text-green-400" : item.status === "archived" ? "text-slate-700 dark:text-slate-300" : "text-amber-700 dark:text-amber-400"}>{item.status || "draft"}</span>
//           </div>
//           <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
//         </div>
//
//         <div className="p-5 pt-6 flex flex-col min-h-[160px]">
//           <h3 className="font-semibold text-base sm:text-lg text-slate-900 dark:text-slate-100 truncate">{item.title || "Untitled Listing"}</h3>
//           <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 mt-1">{item.description || "No description available."}</p>
//
//           <div className="mt-auto pt-3 flex items-end justify-between gap-3">
//             <div className="min-w-0 flex items-center gap-2">
//               <div className="shrink-0 rounded-xl p-2 bg-slate-100 text-slate-700 shadow dark:bg-slate-800 dark:text-slate-300" />
//               <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate" title={subtitle}>{subtitle}</p>
//             </div>
//
//             {priceText && (
//               <div className="flex items-center gap-2">
//                 <p className="text-base font-bold text-slate-900 dark:text-slate-100">{priceText}</p>
//               </div>
//             )}
//           </div>
//
//           <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
//             <div>Bookings: <strong className="text-slate-900 dark:text-slate-100">{item.bookingCount || 0}</strong></div>
//             <div>Rating: <strong className="text-slate-900 dark:text-slate-100">{item.ratingCount ? `${item.ratingAvg?.toFixed(1)} (${item.ratingCount})` : '—'}</strong></div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

export default function AdminListingsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar() || {};
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode] = useState("all"); // all | booked | rated
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const listingsRef = collection(database, "listings");
        const ls = await getDocs(listingsRef);
        let rows = ls.docs.map((d) => {
          const v = d.data() || {};

          // category
          const rawCategory = v.category ?? v.listingCategory ?? null;
          const category =
            typeof rawCategory === "string"
              ? rawCategory
              : rawCategory?.name ||
                (v.experienceType ? "Experiences" : v.serviceType || v.type ? "Services" : "Homes");

          // location
          let location = v.location || v.address || v.municipality?.name || v.province?.name || "";
          if (!location) {
            const catLower = String(category || "").toLowerCase();
            if (catLower.startsWith("experience")) {
              location = v.experienceType || v.locationType || "";
            } else if (catLower.startsWith("service")) {
              location = v.locationType || "";
            }
          }

          return {
            id: d.id,
            title: v.title || "Untitled",
            description: v.description || "",
            photos: v.photos || [],
            cover: v.coverUrl || null,
            price: v.price ?? null,
            status: v.status || "",
            category,
            location,
            createdAt: v?.createdAt?.toDate ? v.createdAt.toDate() : v?.createdAt ? new Date(v.createdAt) : null,
            hostUid: v?.uid || v?.hostId || v?.ownerId || v?.host?.uid || null,
            serviceType: v.serviceType || v.type || null,
            experienceType: v.experienceType || null,
          };
        });

        // Optimize bookings and reviews - load in parallel and only for visible listings
        const ids = rows.map((r) => r.id).filter(Boolean);
        const bookCount = {};
        const acc = new Map(); // id -> { sum, count }
        
        // Create parallel queries for reviews
        const reviewBatches = chunk(ids, 10);
        const reviewQueries = reviewBatches.map((b) =>
          getDocs(query(collection(database, "reviews"), where("listingId", "in", b)))
            .catch(() => ({ docs: [] }))
        );

        // Create parallel queries for bookings
        const bookingBatches = chunk(ids, 10);
        const bookingQueries = bookingBatches.map((b) =>
          getDocs(query(collection(database, "bookings"), where("listingId", "in", b)))
            .catch(() => ({ docs: [] }))
        );

        // Execute review and booking queries in parallel
        const [reviewResults, bookingResults] = await Promise.all([
          Promise.all(reviewQueries),
          Promise.all(bookingQueries),
        ]);

        // Process review results
        reviewResults.forEach((snap) => {
          snap.docs.forEach((d) => {
            const v = d.data() || {};
            const lid = v?.listingId;
            const ratingNum = Number(v?.rating);
            if (!lid || !Number.isFinite(ratingNum)) return;
            if (!acc.has(lid)) acc.set(lid, { sum: 0, count: 0 });
            const cur = acc.get(lid);
            cur.sum += ratingNum;
            cur.count += 1;
          });
        });

        // Process booking results - count bookings per listing
        bookingResults.forEach((snap) => {
          snap.docs.forEach((d) => {
            const v = d.data() || {};
            const lid = getListingIdFromBooking(v) || v?.listingId;
            if (!lid) return;
            bookCount[lid] = (bookCount[lid] || 0) + 1;
          });
        });

        // enrich rows
        rows = rows.map((r) => {
          const rc = acc.get(r.id) || { sum: 0, count: 0 };
          const avg = rc.count ? rc.sum / rc.count : 0;
          return {
            ...r,
            bookingCount: bookCount[r.id] || 0,
            ratingAvg: avg,
            ratingCount: rc.count || 0,
          };
        });

        // Optimize host name resolution - use parallel queries
        try {
          const hostUids = Array.from(new Set(rows.map((r) => r.hostUid).filter(Boolean)));
          if (hostUids.length) {
            const hostMap = {};
            const hbatches = chunk(hostUids, 10);
            const hostQueries = [];

            // Create parallel queries for both uid and documentId
            for (const hb of hbatches) {
              hostQueries.push(
                getDocs(query(collection(database, "hosts"), where("uid", "in", hb)))
                  .catch(() => ({ docs: [] }))
              );
              hostQueries.push(
                getDocs(query(collection(database, "hosts"), where(documentId(), "in", hb)))
                  .catch(() => ({ docs: [] }))
              );
            }

            // Execute all host queries in parallel
            const hostResults = await Promise.all(hostQueries);
            hostResults.forEach((snap) => {
              snap.docs.forEach((doc) => {
                  const data = doc.data() || {};
                  const uid = data.uid || doc.id;
                  const name =
                    data.displayName ||
                    ((data.firstName || "") + " " + (data.lastName || "")).trim() ||
                    data.email ||
                    uid;
                  hostMap[uid] = name;
                  hostMap[doc.id] = name;
                });
            });
            rows = rows.map((r) => ({
              ...r,
              hostName: hostMap[r.hostUid] || hostMap[r.hostUid] || null,
            }));
          }
        } catch (e) {
          console.warn("Failed to resolve host names:", e);
        }

        setListings(rows);
      } catch (e) {
        console.error("Failed to load listings:", e);
        setListings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    listings.forEach((l) => {
      if (l.category) cats.add(l.category);
    });
    return Array.from(cats).sort();
  }, [listings]);

  // SORTED (fixed useMemo)
  const sorted = useMemo(() => {
    const s = String(search || "").trim().toLowerCase();
    let filtered = listings.slice();
    
    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((l) => l.category === categoryFilter);
    }
    
    // Apply search filter
    if (s) {
      filtered = filtered.filter((l) => {
        const hay = [l.title, l.category, l.location, l.hostName, l.hostUid]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(s);
      });
    }

    const cmp = (a, b, key) => {
      const va = a?.[key];
      const vb = b?.[key];
      if (va == null && vb == null) return 0;
      if (va == null) return -1;
      if (vb == null) return 1;
      if (key === "title" || typeof va === "string")
        return String(va).localeCompare(String(vb));
      return Number(va) - Number(vb);
    };

    let base = filtered;
    const explicitSort = Boolean(sortKey && sortKey !== "createdAt");

    if (!explicitSort) {
      if (mode === "booked") {
        base = filtered.slice().sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0));
      } else if (mode === "rated") {
        base = filtered.slice().sort((a, b) => {
          const ar = a.ratingAvg || 0;
          const br = b.ratingAvg || 0;
          if (br === ar) return (b.ratingCount || 0) - (a.ratingCount || 0);
          return br - ar;
        });
      } else {
        base = filtered.slice().sort((a, b) => {
          const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
          const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
          return tb - ta;
        });
      }
    }

    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      return base.slice().sort((a, b) => dir * cmp(a, b, sortKey));
    }

    return base;
  }, [listings, mode, search, categoryFilter, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, pageSize, sorted.length]);

  const pagedListings = sorted.slice((page - 1) * pageSize, page * pageSize);

  // REPORT METRICS (derived from existing data; UI only)
  const metrics = useMemo(() => {
    const total = listings.length;
    const statusCounts = listings.reduce((m, l) => {
      const s = (l.status || "").toLowerCase();
      m[s] = (m[s] || 0) + 1;
      return m;
    }, {});
    const published = statusCounts["published"] || 0;
    const archived = statusCounts["archived"] || 0;
    const draft = total - published - archived;
    const totalBookings = listings.reduce((sum, l) => sum + (l.bookingCount || 0), 0);

    // weighted avg rating by ratingCount
    let ratingSum = 0,
      ratingN = 0;
    for (const l of listings) {
      if (l.ratingCount) {
        ratingSum += (l.ratingAvg || 0) * l.ratingCount;
        ratingN += l.ratingCount;
      }
    }
    const avgRating = ratingN ? ratingSum / ratingN : 0;

    // average price across listings with numeric price
    const priced = listings.filter((l) => Number.isFinite(Number(l.price)));
    const avgPrice = priced.length
      ? priced.reduce((s, l) => s + Number(l.price), 0) / priced.length
      : 0;

    // top category distribution
    const catCounts = listings.reduce((m, l) => {
      const c = l.category || "Uncategorized";
      m[c] = (m[c] || 0) + 1;
      return m;
    }, {});
    const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    // top listing by bookings
    const topBooked = listings.reduce(
      (best, l) =>
        (l.bookingCount || 0) > (best?.bookingCount || 0) ? l : best,
      null
    );

    return {
      total,
      published,
      archived,
      draft,
      totalBookings,
      avgRating,
      avgPrice,
      categories,
      topBooked,
    };
  }, [listings]);

  // export CSV
  const exportCSV = () => {
    try {
      const rows = sorted || [];
      const headers = ["ID", "Title", "Host", "Category", "Location", "Price", "Bookings", "Rating", "Status"];
      const lines = [headers.join(",")];
      for (const r of rows) {
        const cols = [
          r.id,
          (r.title || "").replace(/"/g, '""'),
          r.hostName || r.hostUid || "",
          r.category || "",
          r.location || "",
          r.price != null ? Number(r.price) : "",
          r.bookingCount || 0,
          r.ratingCount ? `${(r.ratingAvg || 0).toFixed(1)} (${r.ratingCount})` : "",
          r.status || "",
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
      a.download = `listings_export_${new Date().toISOString().slice(0, 10)}.csv`;
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

    // quick aggregates for header chips
    const totalListings = rows.length;
    const totalBookings = rows.reduce((s, r) => s + (r.bookingCount || 0), 0);
    let ratSum = 0, ratN = 0;
    rows.forEach(r => { if (r.ratingCount) { ratSum += (r.ratingAvg || 0) * r.ratingCount; ratN += r.ratingCount; }});
    const avgRating = ratN ? (ratSum / ratN) : 0;

    const priced = rows.filter(r => Number.isFinite(Number(r.price)));
    const avgPrice = priced.length ? priced.reduce((s, r) => s + Number(r.price), 0) / priced.length : 0;

    const nowStr = new Date().toLocaleString();

    const html = [];
    html.push(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bookify — Listings Report</title>
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
    thead th{ text-align:left; padding:10px 12px; font-size:11px; color:#334155; border-bottom:1px solid var(--line); }
    tbody td{ padding:10px 12px; border-bottom:1px solid var(--line); background:#fff; vertical-align:top; }
    tbody tr:nth-child(even) td{ background:var(--subtle); }
    .mono{ font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace; font-size:11px; color:#475569; }
    .num{ text-align:right; }
    .status{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:600; border:1px solid var(--line); background:#fff; color:#1f2937; }
    .status .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
    .dot.pub{ background:#10b981; }  /* published */
    .dot.arc{ background:#94a3b8; }  /* archived */
    .dot.dra{ background:#f59e0b; }  /* draft */

    .footer{ position:fixed; bottom:10mm; left:18mm; right:18mm; color:var(--muted); font-size:11px; display:flex; justify-content:space-between; }
    tfoot{ display: table-footer-group; }
    .page-num:after { counter-increment: page; content: counter(page); }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Listings Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Rows: ${totalListings.toLocaleString()}
    </div>
  </div>

  <div class="chips">
    <span class="chip"><span class="dot"></span><b>Total Listings:</b> ${totalListings.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Total Bookings:</b> ${totalBookings.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Avg Rating:</b> ${avgRating ? avgRating.toFixed(1) : "—"}</span>
    <span class="chip"><span class="dot"></span><b>Avg Price:</b> ${avgPrice ? formatPeso(Math.round(avgPrice)) : "—"}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:88px;">ID</th>
        <th style="width:22%;">Title</th>
        <th style="width:16%;">Host</th>
        <th style="width:14%;">Category</th>
        <th style="width:18%;">Location</th>
        <th class="num" style="width:90px;">Price</th>
        <th class="num" style="width:90px;">Bookings</th>
        <th class="num" style="width:110px;">Rating</th>
        <th style="width:90px;">Status</th>
      </tr>
    </thead>
    <tbody>`);

    for (const r of rows) {
      const status = String(r.status || "").toLowerCase();
      const dotClass = status === "published" ? "pub" : status === "archived" ? "arc" : "dra";

      html.push(`<tr>
        <td class="mono">${escapeHtml(String(r.id).slice(0,8))}…</td>
        <td>${escapeHtml(r.title || "")}</td>
        <td>${escapeHtml(r.hostName || r.hostUid || "")}</td>
        <td>${escapeHtml(r.category || "")}</td>
        <td>${escapeHtml(r.location || "")}</td>
        <td class="num">${r.price != null ? escapeHtml(formatPeso(r.price)) : "—"}</td>
        <td class="num">${escapeHtml(String(r.bookingCount || 0))}</td>
        <td class="num">${r.ratingCount ? escapeHtml(`${(r.ratingAvg || 0).toFixed(1)} (${r.ratingCount})`) : "—"}</td>
        <td><span class="status"><span class="dot ${dotClass}"></span>${escapeHtml(r.status || "—")}</span></td>
      </tr>`);
    }

    html.push(`</tbody>
  </table>

  <div class="footer">
    <div>Bookify • Listings export</div>
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
        filename: `listings_export_${new Date().toISOString().slice(0, 10)}.pdf`,
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

// small HTML escape helper for exportPDF
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


  // UI helpers
  const badgeClass = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "published")
      return "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800";
    if (s === "archived")
      return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:ring-slate-700";
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
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Listings</span>
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
          {/* Total Listings */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Listings</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total}</p>
            <div className="mt-2 sm:mt-3 flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {metrics.published} published
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {metrics.draft} draft
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                {metrics.archived} archived
              </span>
            </div>
          </div>

          {/* Bookings */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Bookings</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
              {metrics.totalBookings.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Top listing:{" "}
              <span className="font-medium text-slate-800">
                {metrics.topBooked?.title || "—"}
              </span>{" "}
              ({metrics.topBooked?.bookingCount || 0})
            </p>
          </div>

          {/* Ratings */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg Rating</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
              {metrics.avgRating ? metrics.avgRating.toFixed(1) : "—"}
            </p>
            <div className="mt-2 sm:mt-3 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${(metrics.avgRating / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">Avg Price</p>
            <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
              {metrics.avgPrice ? `₱${Math.round(metrics.avgPrice).toLocaleString()}` : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-600">Across priced listings</p>
          </div>
        </section>

        {/* Category distribution */}
        <section className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Category Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {metrics.categories.slice(0, 6).map(([name, count]) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                  {name}
                  <span className="text-slate-400">· {count}</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Controls */}
        <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-4 sm:p-5 md:p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                placeholder="Search title, category, location or host..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white/90 backdrop-blur text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/80 dark:border-slate-700 dark:text-slate-100"
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

          {/* Sort & actions */}
          <div className="lg:col-span-1 flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <TailwindDropdown
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              options={[
                { value: "createdAt", label: "Newest" },
                { value: "price", label: "Price" },
                { value: "bookingCount", label: "Bookings" },
                { value: "ratingAvg", label: "Rating" },
                { value: "title", label: "Title" },
              ]}
              className="min-w-[120px]"
            />
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
            <button
              title="Export CSV"
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-medium shadow hover:bg-indigo-500 active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                <path d="M3 3a2 2 0 0 0-2 2v5a1 1 0 1 0 2 0V5h14v10H7a1 1 0 1 0 0 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H3Z" />
                <path d="M10 14a1 1 0 0 1-1-1V7a1 1 0 1 1 2 0v6a1 1 0 0 1-1 1Z" />
                <path d="M7.293 11.707a1 1 0 0 1 0-1.414l2-2a1 1 0 1 1 1.414 1.414L9.414 10l1.293 1.293a1 1 0 0 1-1.414 1.414l-2-2Z" />
              </svg>
              <span className="hidden xs:inline">Export CSV</span><span className="xs:hidden">CSV</span>
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
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">No matching listings</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="relative rounded-2xl border border-slate-200 bg-white/80 backdrop-blur shadow-sm dark:bg-slate-900/70 dark:border-slate-700">
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-none rounded-2xl sm:-mx-3 sm:mx-0" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-slate-900/80">
                  <tr className="text-left text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 pl-4 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm">ID</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm">Title</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden sm:table-cell">Host</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden md:table-cell">Category</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm hidden lg:table-cell">Location</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm text-right">Price</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm text-right hidden md:table-cell">Bookings</th>
                    <th className="py-3 pr-2 sm:pr-4 font-semibold text-xs sm:text-sm text-right hidden lg:table-cell">Rating</th>
                    <th className="py-3 pr-4 font-semibold text-xs sm:text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedListings.map((l, idx) => (
                    <tr
                      key={l.id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 ${
                        idx % 2 === 0 ? "bg-white/70 dark:bg-slate-900/40" : "bg-white/40 dark:bg-slate-900/30"
                      }`}
                    >
                      <td className="py-3 pl-4 pr-2 sm:pr-4 font-mono text-xs text-slate-500">{String(l.id).slice(0, 8)}…</td>
                      <td className="py-3 pr-2 sm:pr-4 font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">{l.title}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm hidden sm:table-cell">{l.hostName || l.hostUid || "—"}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm hidden md:table-cell">{l.category || "—"}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-slate-700 dark:text-slate-200 text-xs sm:text-sm hidden lg:table-cell">{l.location || "—"}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-right text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                        {l.price != null ? formatPeso(l.price) : "—"}
                      </td>
                      <td className="py-3 pr-2 sm:pr-4 text-right text-slate-900 dark:text-slate-100 text-xs sm:text-sm hidden md:table-cell">{l.bookingCount || 0}</td>
                      <td className="py-3 pr-2 sm:pr-4 text-right text-slate-900 dark:text-slate-100 text-xs sm:text-sm hidden lg:table-cell">
                        {l.ratingCount ? `${(l.ratingAvg || 0).toFixed(1)} (${l.ratingCount})` : "—"}
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${badgeClass(l.status)}`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              l.status?.toLowerCase() === "published"
                                ? "bg-emerald-500"
                                : l.status?.toLowerCase() === "archived"
                                ? "bg-slate-400"
                                : "bg-amber-500"
                            }`}
                          ></span>
                          {l.status || "—"}
                        </span>
                      </td>
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
    </div>
  );
}
