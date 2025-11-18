// src/pages/admin/rewards.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { database, auth } from "../../config/firebase";
import AdminSidebar from "./components/AdminSidebar.jsx";
import { useSidebar } from "../../context/SidebarContext";
import BookifyLogo from "../../components/bookify-logo.jsx";
import {
  Gift,
  Plus,
  Edit3,
  Trash2,
  X,
  Percent,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function AdminRewardsPage() {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    name: "",
    description: "",
    pointsCost: "",
    discountType: "percentage",
    discountValue: "",
    active: true,
    expiresInDays: "",
  });

  const [errors, setErrors] = useState({});

  // Load rewards
  useEffect(() => {
    const loadRewards = async () => {
      try {
        setLoading(true);
        const rewardsRef = collection(database, "rewards");
        const q = query(rewardsRef, orderBy("pointsCost", "asc"));
        const snap = await getDocs(q);
        const rewardsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRewards(rewardsList);
      } catch (e) {
        console.error("Failed to load rewards:", e);
        alert("Failed to load rewards.");
      } finally {
        setLoading(false);
      }
    };
    loadRewards();
  }, []);

  // Validate form
  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.pointsCost || Number(formData.pointsCost) <= 0)
      errs.pointsCost = "Points cost must be greater than 0";
    if (!formData.discountValue || Number(formData.discountValue) <= 0)
      errs.discountValue = "Discount value is required";
    if (formData.discountType === "percentage" && Number(formData.discountValue) > 100)
      errs.discountValue = "Percentage cannot exceed 100%";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Save reward
  const handleSave = async () => {
    if (!validate()) return;

    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to save rewards.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        pointsCost: Number(formData.pointsCost),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        active: formData.active,
        expiresInDays: formData.expiresInDays ? Number(formData.expiresInDays) : null,
        uid: user.uid, // Required by Firestore security rules
        updatedAt: serverTimestamp(),
      };

      if (formData.id) {
        await updateDoc(doc(database, "rewards", formData.id), payload);
      } else {
        await addDoc(collection(database, "rewards"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      // Reload rewards
      const rewardsRef = collection(database, "rewards");
      const q = query(rewardsRef, orderBy("pointsCost", "asc"));
      const snap = await getDocs(q);
      const rewardsList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRewards(rewardsList);

      // Reset form
      setFormData({
        id: null,
        name: "",
        description: "",
        pointsCost: "",
        discountType: "percentage",
        discountValue: "",
        active: true,
        expiresInDays: "",
      });
      setErrors({});
      alert("Reward saved successfully!");
    } catch (e) {
      console.error("Failed to save reward:", e);
      const errorMessage = e?.message || "Unknown error occurred";
      alert(`Failed to save reward: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // Edit reward
  const handleEdit = (reward) => {
    setFormData({
      id: reward.id,
      name: reward.name || "",
      description: reward.description || "",
      pointsCost: String(reward.pointsCost || ""),
      discountType: reward.discountType || "percentage",
      discountValue: String(reward.discountValue || reward.value || ""),
      active: reward.active !== false,
      expiresInDays: reward.expiresInDays ? String(reward.expiresInDays) : "",
    });
    setErrors({});
  };

  // Delete reward
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this reward?")) return;

    setDeletingId(id);
    try {
      await deleteDoc(doc(database, "rewards", id));
      setRewards(rewards.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to delete reward:", e);
      alert("Failed to delete reward.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <AdminSidebar />

      <header
        className={`fixed top-0 right-0 z-30 bg-white text-gray-800 border-b border-gray-200 shadow-sm transition-all duration-300 left-0 ${sidebarOpen ? "md:left-72" : "md:left-20"}`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={() => navigate("/admin-dashboard")}
            >
              <BookifyLogo />
              <span className="hidden sm:inline font-semibold text-gray-800">Rewards Management</span>
            </div>
          </div>
        </div>
      </header>

      <div className={`h-[56px] md:h-[56px]`} />

      <main
        className={`transition-[margin] duration-300 ml-0 ${sidebarOpen ? "md:ml-72" : "md:ml-20"} px-4 sm:px-6 lg:px-12 py-6`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">Rewards Management</h1>
            <p className="text-muted-foreground">Create and manage rewards that guests can redeem with points.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-500" />
                {formData.id ? "Edit Reward" : "Create New Reward"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Reward Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    placeholder="e.g., 10% Off Booking"
                  />
                  {errors.name && (
                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Points Cost *</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.pointsCost}
                      onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                      placeholder="100"
                    />
                    {errors.pointsCost && (
                      <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle size={12} /> {errors.pointsCost}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type *</label>
                    <select
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₱)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Discount Value *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    placeholder={formData.discountType === "percentage" ? "10" : "500"}
                  />
                  {errors.discountValue && (
                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.discountValue}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expires In (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.expiresInDays}
                    onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    placeholder="Leave blank for no expiration"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-slate-700">
                    Active (visible to guests)
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50 ${
                      formData.id
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        {formData.id ? "Update Reward" : "Create Reward"}
                      </>
                    )}
                  </button>
                  {formData.id && (
                    <button
                      onClick={() => {
                        setFormData({
                          id: null,
                          name: "",
                          description: "",
                          pointsCost: "",
                          discountType: "percentage",
                          discountValue: "",
                          active: true,
                          expiresInDays: "",
                        });
                        setErrors({});
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="rounded-3xl border border-white/40 bg-white/80 backdrop-blur-sm shadow-lg p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">All Rewards ({rewards.length})</h2>

              {loading ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Loading rewards...</span>
                </div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="mx-auto text-slate-300 mb-3" size={48} />
                  <p className="text-sm text-slate-600">No rewards created yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className={`rounded-2xl border-2 p-4 ${
                        reward.active
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 opacity-75"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900">{reward.name}</h3>
                            {reward.active ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                <CheckCircle2 size={10} className="mr-1" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                                Inactive
                              </span>
                            )}
                          </div>
                          {reward.description && (
                            <p className="text-sm text-slate-600 mb-2">{reward.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                              {reward.pointsCost} pts
                            </span>
                            {reward.discountType === "percentage" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                <Percent size={10} />
                                {reward.discountValue}% OFF
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                                <Tag size={10} />
                                ₱{Number(reward.discountValue || reward.value || 0).toLocaleString()} OFF
                              </span>
                            )}
                            {reward.expiresInDays && (
                              <span className="text-xs text-slate-500">
                                Expires in {reward.expiresInDays} days
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => handleEdit(reward)}
                            className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
                            title="Edit"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(reward.id)}
                            disabled={deletingId === reward.id}
                            className="p-2 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === reward.id ? (
                              <Loader2 className="animate-spin" size={16} />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

