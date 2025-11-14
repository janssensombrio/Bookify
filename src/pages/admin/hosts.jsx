import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./components/AdminSidebar.jsx";
import BookifyLogo from "../../components/bookify-logo.jsx";
import { database } from "../../config/firebase";
import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy, getDoc } from "firebase/firestore";
import { CheckCircle2, XCircle, Search, ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, Download, Menu, Settings, Save, Edit2, FileText, Percent } from "lucide-react";
import BookifyIcon from "../../media/favorite.png";
import { useSidebar } from "../../context/SidebarContext";

function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  } catch {
    return "—";
  }
}

export default function AdminHostsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar() || {};
  const sideOffset = sidebarOpen === false ? "md:ml-20" : "md:ml-72";
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");
  const [verifiedFilter, setVerifiedFilter] = useState("all"); // all, verified, unverified
  const [activeFilter, setActiveFilter] = useState("all"); // all, active, inactive

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmHostId, setConfirmHostId] = useState(null);
  const [confirmWant, setConfirmWant] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Service Fees & Policies state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    serviceFeeHomes: 10, // percentage
    serviceFeeExperiences: 20, // percentage
    serviceFeeServices: 12, // percentage
    policies: [
      "Legal Compliance: You'll comply with all local laws, permits, tax obligations, and HOA/building rules that apply to short-term hosting or experiences/services.",
      "Safety: Maintain a safe environment (e.g., working locks, smoke/CO detectors for homes; appropriate equipment and safety briefings for experiences/services).",
      "Accuracy: Your listing details, photos, amenities, pricing, and accessibility information must be accurate and kept up to date.",
      "Cleanliness & Maintenance: Provide a clean, well-maintained space or service that matches guest expectations.",
      "Guest Conduct & House Rules: Clearly disclose your rules (pets, smoking, noise, parties) and enforce them consistently and fairly.",
      "Cancellations & Refunds: Honor your chosen cancellation policy and communicate promptly if issues arise.",
      "Fair Pricing: All fees must be disclosed. No off-platform payments or hidden charges.",
      "Non-Discrimination: Provide equal access and do not discriminate against guests.",
      "Privacy: No hidden cameras or undisclosed monitoring devices. Respect guest data privacy.",
      "Support: Be reachable during bookings and resolve issues in good faith."
    ]
  });
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  /* --- Load settings from Firestore --- */
  useEffect(() => {
    (async () => {
      setSettingsLoading(true);
      try {
        const settingsRef = doc(database, "settings", "hostPolicies");
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data();
          const defaultPolicies = [
            "Legal Compliance: You'll comply with all local laws, permits, tax obligations, and HOA/building rules that apply to short-term hosting or experiences/services.",
            "Safety: Maintain a safe environment (e.g., working locks, smoke/CO detectors for homes; appropriate equipment and safety briefings for experiences/services).",
            "Accuracy: Your listing details, photos, amenities, pricing, and accessibility information must be accurate and kept up to date.",
            "Cleanliness & Maintenance: Provide a clean, well-maintained space or service that matches guest expectations.",
            "Guest Conduct & House Rules: Clearly disclose your rules (pets, smoking, noise, parties) and enforce them consistently and fairly.",
            "Cancellations & Refunds: Honor your chosen cancellation policy and communicate promptly if issues arise.",
            "Fair Pricing: All fees must be disclosed. No off-platform payments or hidden charges.",
            "Non-Discrimination: Provide equal access and do not discriminate against guests.",
            "Privacy: No hidden cameras or undisclosed monitoring devices. Respect guest data privacy.",
            "Support: Be reachable during bookings and resolve issues in good faith."
          ];
          setSettings({
            serviceFeeHomes: data.serviceFeeHomes ?? 10,
            serviceFeeExperiences: data.serviceFeeExperiences ?? 20,
            serviceFeeServices: data.serviceFeeServices ?? 12,
            policies: data.policies || defaultPolicies
          });
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setSettingsLoading(false);
      }
    })();
  }, []);

  /* --- Save settings to Firestore --- */
  const saveSettings = async () => {
    try {
      const settingsRef = doc(database, "settings", "hostPolicies");
      await setDoc(settingsRef, {
        ...settings,
        updatedAt: new Date(),
        updatedBy: "admin"
      }, { merge: true });
      setEditingSettings(false);
      alert("Settings saved successfully!");
    } catch (e) {
      console.error("Failed to save settings:", e);
      alert("Failed to save settings: " + String(e));
    }
  };

  /* --- data load (unchanged logic) --- */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const hostsRef = collection(database, "hosts");
        const q = query(hostsRef, orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => {
          const v = d.data() || {};
          return {
            id: d.id,
            uid: v?.uid || d.id,
            name: v?.displayName || [v?.firstName, v?.lastName].filter(Boolean).join(" ") || "—",
            email: v?.email || "—",
            isVerified: v?.isVerified === true || String(v?.isVerified).toLowerCase() === "true",
            active: typeof v?.active === "boolean" ? v.active : true,
            createdAt: v?.createdAt || v?.created || null,
            photoURL: v?.photoURL || null, // purely presentational
            raw: v,
          };
        });
        setHosts(rows);
      } catch (e) {
        console.error("Failed to load hosts:", e);
        setHosts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --- search, filter & sort --- */
  const normalizedSearch = (s) => String(s || "").trim().toLowerCase();
  
  const filteredHosts = useMemo(() => {
    let filtered = hosts;
    
    // Search filter
    if (searchTerm) {
      const t = normalizedSearch(searchTerm);
      filtered = filtered.filter((h) => {
        return (
          String(h.name || "").toLowerCase().includes(t) ||
          String(h.email || "").toLowerCase().includes(t) ||
          String(h.id || "").toLowerCase().includes(t)
        );
      });
    }
    
    // Verified filter
    if (verifiedFilter !== "all") {
      filtered = filtered.filter((h) => {
        if (verifiedFilter === "verified") return h.isVerified === true;
        if (verifiedFilter === "unverified") return h.isVerified !== true;
        return true;
      });
    }
    
    // Active filter
    if (activeFilter !== "all") {
      filtered = filtered.filter((h) => {
        if (activeFilter === "active") return h.active === true;
        if (activeFilter === "inactive") return h.active === false;
        return true;
      });
    }
    
    // Sort
    const dir = sortDir === "asc" ? 1 : -1;
    filtered = filtered.slice().sort((a, b) => {
      if (sortKey === "createdAt") {
        const aDate = a.createdAt ? (a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
        const bDate = b.createdAt ? (b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
        return dir * (aDate.getTime() - bDate.getTime());
      }
      if (sortKey === "name") {
        return dir * String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortKey === "email") {
        return dir * String(a.email || "").localeCompare(String(b.email || ""));
      }
      return 0;
    });
    
    return filtered;
  }, [hosts, searchTerm, verifiedFilter, activeFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredHosts.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, pageSize, filteredHosts.length, verifiedFilter, activeFilter]);

  const pagedHosts = filteredHosts.slice((page - 1) * pageSize, page * pageSize);
  
  // Calculate metrics for PDF export
  const metrics = useMemo(() => {
    const total = filteredHosts.length;
    const verified = filteredHosts.filter((h) => h.isVerified === true).length;
    const unverified = filteredHosts.filter((h) => h.isVerified !== true).length;
    const active = filteredHosts.filter((h) => h.active === true).length;
    const inactive = filteredHosts.filter((h) => h.active === false).length;
    return { total, verified, unverified, active, inactive };
  }, [filteredHosts]);
  
  // CSV export
  const exportCSV = () => {
    try {
      const rows = filteredHosts || [];
      const headers = ["ID", "Name", "Email", "Verified", "Active", "Created"];
      const lines = [headers.join(",")];
      for (const h of rows) {
        const cols = [
          h.id,
          (h.name || "").replace(/"/g, '""'),
          (h.email || "").replace(/"/g, '""'),
          h.isVerified ? "Yes" : "No",
          h.active ? "Active" : "Inactive",
          h.createdAt ? (h.createdAt?.toDate ? h.createdAt.toDate().toISOString() : new Date(h.createdAt).toISOString()) : "",
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
      a.download = `hosts_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export CSV", e);
      alert("Failed to export CSV: " + String(e));
    }
  };
  
  // Export PDF via download
  const exportPDF = async () => {
    try {
      const rows = filteredHosts || [];

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
  <title>Bookify — Hosts Report</title>
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
    .status{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:11px; font-weight:600; border:1px solid var(--line); background:#fff; color:#1f2937; }
    .status .dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
    .dot.verified{ background:#10b981; }
    .dot.unverified{ background:#94a3b8; }
    .dot.active{ background:#10b981; }
    .dot.inactive{ background:#ef4444; }

    .footer{ position:fixed; bottom:10mm; left:18mm; right:18mm; color:var(--muted); font-size:11px; display:flex; justify-content:space-between; }
    tfoot{ display: table-footer-group; }
  </style>
</head>
<body>

  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Hosts Report</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}<br/>
      Rows: ${rows.length.toLocaleString()}
    </div>
  </div>

  <div class="chips">
    <span class="chip"><span class="dot"></span><b>Total Hosts:</b> ${metrics.total.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Verified:</b> ${metrics.verified.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Unverified:</b> ${metrics.unverified.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Active:</b> ${metrics.active.toLocaleString()}</span>
    <span class="chip"><span class="dot"></span><b>Inactive:</b> ${metrics.inactive.toLocaleString()}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:15%;">ID</th>
        <th style="width:20%;">Name</th>
        <th style="width:25%;">Email</th>
        <th style="width:12%;">Verified</th>
        <th style="width:12%;">Active</th>
        <th style="width:16%;">Joined</th>
      </tr>
    </thead>
    <tbody>`);

      for (const h of rows) {
        const verifiedClass = h.isVerified ? "verified" : "unverified";
        const activeClass = h.active ? "active" : "inactive";
        const verifiedText = h.isVerified ? "Verified" : "Unverified";
        const activeText = h.active ? "Active" : "Inactive";
        const joinedDate = h.createdAt 
          ? (h.createdAt?.toDate ? h.createdAt.toDate().toLocaleDateString() : new Date(h.createdAt).toLocaleDateString())
          : "—";

        html.push(`<tr>
        <td class="mono">${escapeHtml(String(h.id).slice(0, 8))}…</td>
        <td>${escapeHtml(h.name)}</td>
        <td>${escapeHtml(h.email)}</td>
        <td><span class="status"><span class="dot ${verifiedClass}"></span>${escapeHtml(verifiedText)}</span></td>
        <td><span class="status"><span class="dot ${activeClass}"></span>${escapeHtml(activeText)}</span></td>
        <td>${escapeHtml(joinedDate)}</td>
      </tr>`);
      }

      html.push(`</tbody>
  </table>

  <div class="footer">
    <div>Bookify • Hosts export</div>
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
          filename: `hosts_export_${new Date().toISOString().slice(0, 10)}.pdf`,
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

  /* --- confirm dialog (unchanged logic) --- */
  const openConfirm = (hostId, current) => {
    const want = !current;
    const txt = want
      ? "Are you sure you want to ACTIVATE this host account?"
      : "Are you sure you want to DEACTIVATE this host account? This will prevent the host from creating or managing listings.";
    setConfirmHostId(hostId);
    setConfirmWant(want);
    setConfirmText(txt);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmHostId(null);
    setConfirmWant(false);
    setConfirmText("");
  };

  const doToggleActive = async () => {
    if (!confirmHostId) return closeConfirm();
    try {
      setBusyId(confirmHostId);
      const ref = doc(database, "hosts", confirmHostId);
      await updateDoc(ref, { active: confirmWant, updatedAt: new Date() });
      setHosts((prev) => prev.map((h) => (h.id === confirmHostId ? { ...h, active: confirmWant } : h)));
      closeConfirm();
    } catch (e) {
      console.error("Failed to update host active status:", e);
      alert("Failed to update host status. See console for details.");
    } finally {
      setBusyId(null);
    }
  };

  /* --- Export Settings CSV --- */
  const exportSettingsCSV = () => {
    try {
      const rows = [
        ["Setting", "Value"],
        ["Service Fee - Homes (%)", settings.serviceFeeHomes],
        ["Service Fee - Experiences (%)", settings.serviceFeeExperiences],
        ["Service Fee - Services (%)", settings.serviceFeeServices],
        ["", ""],
        ["Policy #", "Policy Text"]
      ];
      settings.policies.forEach((policy, idx) => {
        rows.push([idx + 1, policy.replace(/"/g, '""')]);
      });
      const csv = rows.map(row => 
        row.map(cell => {
          const s = String(cell || "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        }).join(",")
      ).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `host_policies_settings_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export settings CSV", e);
      alert("Failed to export CSV: " + String(e));
    }
  };

  /* --- Export Settings PDF --- */
  const exportSettingsPDF = async () => {
    try {
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
  <title>Bookify — Host Policies & Service Fees</title>
  <style>
    :root{ --brand:#2563eb; --ink:#0f172a; --muted:#64748b; --line:#e5e7eb; --bg:#ffffff; --subtle:#f8fafc; --thead:#f1f5f9; }
    @page{ margin: 18mm; }
    *{-webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box;}
    body{ margin:0; font:12px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:var(--ink); background:var(--bg); }
    .header{ display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--line); }
    .brand{ display:flex; align-items:center; gap:12px; }
    .brand img{ width:28px; height:28px; border-radius:6px; object-fit:cover; }
    .brand h1{ font-size:16px; line-height:1.1; margin:0; }
    .brand small{ color:var(--muted); display:block; font-weight:500; }
    .meta{ text-align:right; color:var(--muted); font-size:11px; }
    .section{ margin:20px 0; }
    .section h2{ font-size:14px; font-weight:600; margin-bottom:12px; color:var(--ink); }
    table{ width:100%; border-collapse:separate; border-spacing:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; margin-bottom:20px; }
    thead{ background:var(--thead); }
    thead th{ text-align:left; padding:10px 12px; font-size:11px; color:#334155; border-bottom:1px solid var(--line); font-weight:600; }
    tbody td{ padding:10px 12px; border-bottom:1px solid var(--line); background:#fff; }
    tbody tr:last-child td{ border-bottom:none; }
    .policy-list{ margin:12px 0; }
    .policy-item{ margin:8px 0; padding:8px 0; border-bottom:1px solid var(--line); }
    .policy-num{ font-weight:600; color:var(--brand); }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${BookifyIcon}" alt="Bookify logo"/>
      <h1>Bookify <small>Host Policies & Service Fees</small></h1>
    </div>
    <div class="meta">
      Generated: ${escapeHtml(nowStr)}
    </div>
  </div>

  <div class="section">
    <h2>Service Fees</h2>
    <table>
      <thead>
        <tr>
          <th style="width:60%;">Category</th>
          <th style="width:40%;">Fee (%)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Homes</td>
          <td>${settings.serviceFeeHomes}%</td>
        </tr>
        <tr>
          <td>Experiences</td>
          <td>${settings.serviceFeeExperiences}%</td>
        </tr>
        <tr>
          <td>Services</td>
          <td>${settings.serviceFeeServices}%</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Hosting Policies</h2>
    <div class="policy-list">`);
      
      settings.policies.forEach((policy, idx) => {
        html.push(`<div class="policy-item">
          <span class="policy-num">${idx + 1}.</span> ${escapeHtml(policy)}
        </div>`);
      });

      html.push(`</div>
  </div>

</body>
</html>`);

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
          filename: `host_policies_settings_${new Date().toISOString().slice(0, 10)}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        };

        await html2pdf().set(opt).from(element).save();
        document.body.removeChild(element);
      } catch (err) {
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
      console.error("Failed to export settings PDF", e);
      alert("Failed to export PDF: " + String(e));
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
                <span className="hidden sm:inline font-semibold text-gray-800 text-sm sm:text-base">Hosts</span>
              </div>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="h-[56px] md:h-[56px]" />

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
          {/* Controls */}
          <div className="glass rounded-2xl border border-white/40 bg-white/80 shadow-sm p-4 md:p-5">
            <div className="flex flex-col gap-3">
              {/* Search and Filters Row */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search hosts by name, email or ID…"
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Filter:</label>
                  <select
                    value={verifiedFilter}
                    onChange={(e) => {
                      setVerifiedFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 sm:min-w-[140px]"
                  >
                    <option value="all">All Verification</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                  <select
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 sm:min-w-[120px]"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              {/* Sort and Actions Row */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Sort by:</label>
                  <select
                    value={sortKey}
                    onChange={(e) => {
                      setSortKey(e.target.value);
                      setPage(1);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="createdAt">Newest</option>
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                  </select>
                  <button
                    title="Toggle sort direction"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <path d="M6 4a1 1 0 0 1 1 1v8.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3A1 1 0 0 1 3.707 12.293L5 13.586V5a1 1 0 0 1 1-1Zm8 12a1 1 0 0 1-1-1V6.414l-1.293 1.293A1 1 0 0 1 10.293 6.293l3-3a1 1 0 0 1 1.414 0l3 3A1 1 0 0 1 16.293 7.707L15 6.414V15a1 1 0 0 1-1 1Z" />
                    </svg>
                    {sortDir === "asc" ? "Asc" : "Desc"}
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                    Total: <span className="font-semibold text-slate-700">{filteredHosts.length}</span>
                  </span>
                  <button
                    onClick={exportCSV}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-medium shadow hover:bg-indigo-500 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap flex-shrink-0"
                  >
                    <Download size={14} className="sm:w-4 sm:h-4 flex-shrink-0" /> <span className="hidden xs:inline">Export CSV</span><span className="xs:hidden">CSV</span>
                  </button>
                  <button
                    onClick={exportPDF}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-medium shadow hover:bg-slate-800 active:translate-y-px focus:outline-none focus:ring-2 focus:ring-slate-700 whitespace-nowrap flex-shrink-0"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" fill="currentColor">
                      <path d="M5 2a2 2 0 0 0-2 2v12l5-3 5 3 5-3V4a2 2 0 0 0-2-2H5Z" />
                    </svg>
                    <span className="hidden xs:inline">Export PDF</span><span className="xs:hidden">PDF</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">Rows</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-2 sm:px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-0 flex-shrink"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Service Fees & Policies Section */}
          <div className="glass rounded-2xl border border-white/40 bg-white/80 shadow-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-200/70 px-4 sm:px-6 py-4 sm:py-5">
              <div className="flex items-center gap-2">
                <Settings className="text-indigo-600 w-5 h-5" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground">
                  Service Fees & Policies
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!editingSettings ? (
                  <>
                    <button
                      onClick={exportSettingsCSV}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Download size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">CSV</span>
                    </button>
                    <button
                      onClick={exportSettingsPDF}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FileText size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">PDF</span>
                    </button>
                    <button
                      onClick={() => setEditingSettings(true)}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-blue-600 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      <Edit2 size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Edit</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        setEditingSettings(false);
                        // Reload settings to discard changes
                        try {
                          const settingsRef = doc(database, "settings", "hostPolicies");
                          const snap = await getDoc(settingsRef);
                          const defaultPolicies = [
                            "Legal Compliance: You'll comply with all local laws, permits, tax obligations, and HOA/building rules that apply to short-term hosting or experiences/services.",
                            "Safety: Maintain a safe environment (e.g., working locks, smoke/CO detectors for homes; appropriate equipment and safety briefings for experiences/services).",
                            "Accuracy: Your listing details, photos, amenities, pricing, and accessibility information must be accurate and kept up to date.",
                            "Cleanliness & Maintenance: Provide a clean, well-maintained space or service that matches guest expectations.",
                            "Guest Conduct & House Rules: Clearly disclose your rules (pets, smoking, noise, parties) and enforce them consistently and fairly.",
                            "Cancellations & Refunds: Honor your chosen cancellation policy and communicate promptly if issues arise.",
                            "Fair Pricing: All fees must be disclosed. No off-platform payments or hidden charges.",
                            "Non-Discrimination: Provide equal access and do not discriminate against guests.",
                            "Privacy: No hidden cameras or undisclosed monitoring devices. Respect guest data privacy.",
                            "Support: Be reachable during bookings and resolve issues in good faith."
                          ];
                          if (snap.exists()) {
                            const data = snap.data();
                            setSettings({
                              serviceFeeHomes: data.serviceFeeHomes ?? 10,
                              serviceFeeExperiences: data.serviceFeeExperiences ?? 20,
                              serviceFeeServices: data.serviceFeeServices ?? 12,
                              policies: data.policies || defaultPolicies
                            });
                          } else {
                            setSettings({
                              serviceFeeHomes: 10,
                              serviceFeeExperiences: 20,
                              serviceFeeServices: 12,
                              policies: defaultPolicies
                            });
                          }
                        } catch (e) {
                          console.error("Failed to reload settings:", e);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSettings}
                      className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-emerald-600 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <Save size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Save</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {settingsLoading ? (
                <div className="text-center text-slate-500 py-8">Loading settings...</div>
              ) : (
                <>
                  {/* Service Fees */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <Percent className="w-4 h-4 text-indigo-600" />
                      Service Fees (Percentage)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Homes</label>
                        {editingSettings ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={settings.serviceFeeHomes}
                            onChange={(e) => setSettings({ ...settings, serviceFeeHomes: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium">{settings.serviceFeeHomes}%</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Experiences</label>
                        {editingSettings ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={settings.serviceFeeExperiences}
                            onChange={(e) => setSettings({ ...settings, serviceFeeExperiences: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium">{settings.serviceFeeExperiences}%</div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Services</label>
                        {editingSettings ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={settings.serviceFeeServices}
                            onChange={(e) => setSettings({ ...settings, serviceFeeServices: Number(e.target.value) })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        ) : (
                          <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium">{settings.serviceFeeServices}%</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Policies */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      Hosting Policies
                    </h4>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {settings.policies.map((policy, idx) => (
                        <div key={idx} className="flex gap-3 items-start">
                          <span className="text-xs font-semibold text-indigo-600 mt-1 shrink-0">{idx + 1}.</span>
                          {editingSettings ? (
                            <textarea
                              value={policy}
                              onChange={(e) => {
                                const newPolicies = [...settings.policies];
                                newPolicies[idx] = e.target.value;
                                setSettings({ ...settings, policies: newPolicies });
                              }}
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px]"
                              rows={2}
                            />
                          ) : (
                            <p className="flex-1 text-sm text-slate-700">{policy}</p>
                          )}
                          {editingSettings && (
                            <button
                              onClick={() => {
                                const newPolicies = settings.policies.filter((_, i) => i !== idx);
                                setSettings({ ...settings, policies: newPolicies });
                              }}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Remove policy"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      {editingSettings && (
                        <button
                          onClick={() => {
                            setSettings({ ...settings, policies: [...settings.policies, "New policy text..."] });
                          }}
                          className="w-full mt-2 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 transition text-sm"
                        >
                          + Add Policy
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="glass rounded-2xl border border-white/40 bg-white/80 shadow-lg overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100/80 rounded animate-pulse" />
                ))}
              </div>
            ) : filteredHosts.length === 0 ? (
              <div className="p-10 text-center text-slate-500">No hosts found.</div>
            ) : (
              <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-none sm:-mx-3 sm:mx-0 px-3 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50/60 sticky top-0 z-10">
                    <tr className="text-left text-slate-600 border-b">
                      <th className="py-3 pl-4 sm:pl-6 pr-4 font-medium">Host</th>
                      <th className="py-3 pr-4 font-medium">Email</th>
                      <th className="py-3 pr-4 font-medium">Verified</th>
                      <th className="py-3 pr-4 font-medium">Active</th>
                      <th className="py-3 pr-4 font-medium">Joined</th>
                      <th className="py-3 pr-4 sm:pr-6 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedHosts.map((h, idx) => (
                      <tr
                        key={h.id}
                        className={`border-b last:border-0 hover:bg-slate-50/60 transition ${
                          idx % 2 === 1 ? "bg-white" : "bg-white"
                        }`}
                      >
                        <td className="py-3 pl-4 sm:pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                              {h.photoURL ? (
                                <img
                                  src={h.photoURL}
                                  alt={h.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">{h.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {h.id.slice(0, 8)}…
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="truncate block max-w-[220px]">{h.email}</span>
                        </td>
                        <td className="py-3 pr-4">
                          {h.isVerified ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title="Verified host"
                            >
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200"
                              title="Not verified"
                            >
                              <XCircle size={12} /> No
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${
                              h.active
                                ? "bg-green-50 text-emerald-700 border-emerald-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {h.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs">{formatDate(h.createdAt)}</td>
                        <td className="py-3 pr-4 sm:pr-6 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              className="px-3 py-1.5 rounded-full text-xs border border-slate-200 bg-white hover:bg-slate-50"
                              onClick={() => window.open(`/hosts/${h.id}`, "_self")}
                            >
                              View
                            </button>
                            <button
                              disabled={busyId === h.id}
                              className={`px-3 py-1.5 rounded-full text-xs border ${
                                h.active
                                  ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              } disabled:opacity-60`}
                              onClick={() => openConfirm(h.id, h.active)}
                            >
                              {h.active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredHosts.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pt-1">
              <div className="text-xs sm:text-sm text-slate-600">
                Showing{" "}
                <span className="font-medium text-slate-800">
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredHosts.length)}
                </span>{" "}
                of <span className="font-medium text-slate-800">{filteredHosts.length}</span>
              </div>
              <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  <ChevronsLeft size={14} className="sm:w-4 sm:h-4 flex-shrink-0" /> <span className="hidden sm:inline">First</span>
                </button>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  <ChevronLeft size={14} className="sm:w-4 sm:h-4 flex-shrink-0" /> <span className="hidden sm:inline">Prev</span>
                </button>
                <span className="px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap">Page {page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  <span className="hidden sm:inline">Next</span> <ChevronRight size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs sm:text-sm hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0"
                >
                  <span className="hidden sm:inline">Last</span> <ChevronsRight size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
                </button>
              </div>
            </div>
          )}
          </div>
        </main>
      </div>

      {/* Confirmation modal (same logic, polished UI) */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeConfirm} />
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-4">
            <div className="w-full sm:w-[520px] rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200 shadow-xl">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`shrink-0 grid place-items-center w-12 h-12 rounded-2xl text-white ${
                      confirmWant
                        ? "bg-gradient-to-b from-emerald-600 to-emerald-700"
                        : "bg-gradient-to-b from-red-600 to-red-700"
                    }`}
                  >
                    {confirmWant ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                      {confirmWant ? "Activate host?" : "Deactivate host?"}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">{confirmText}</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    onClick={closeConfirm}
                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={doToggleActive}
                    disabled={busyId === confirmHostId}
                    className={`h-10 px-4 rounded-xl text-white ${
                      confirmWant
                        ? "bg-gradient-to-b from-emerald-600 to-emerald-700 hover:brightness-105"
                        : "bg-gradient-to-b from-red-600 to-red-700 hover:brightness-105"
                    } disabled:opacity-60`}
                  >
                    {confirmWant ? "Activate" : "Deactivate"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
