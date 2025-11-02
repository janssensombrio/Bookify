// ConfirmStatusModal.jsx — publish-only, modern 3D style (Tailwind)
import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function ConfirmStatusModal({ open, onClose, onConfirm, newStatus, listingTitle }) {
  // newStatus is accepted for backward compatibility but ignored; this modal only confirms publish
  if (!open) return null;

  const title = listingTitle || "this listing";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full sm:w-[520px]">
        <div className="mx-3 sm:mx-0 rounded-2xl bg-gradient-to-b from-white to-slate-50 border border-slate-200/70 shadow-[0_10px_30px_rgba(2,6,23,0.12),inset_0_1px_0_rgba(255,255,255,0.6)] p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="shrink-0 grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_20px_rgba(4,120,87,0.35)] ring-1 ring-white/10">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold tracking-tight text-slate-900">Publish listing?</h3>
              <p className="text-sm text-slate-600 mt-1">
                Are you sure you want to publish <b className="text-slate-900">{title}</b>? It will be visible to guests. You can archive it later anytime.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="group relative h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_4px_10px_rgba(2,6,23,0.06)] hover:shadow-[inset_0_-2px_0_rgba(2,6,23,0.05),0_6px_16px_rgba(2,6,23,0.1)] hover:bg-slate-50 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="group relative h-10 px-4 rounded-xl text-white bg-gradient-to-b from-emerald-600 to-emerald-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_rgba(4,120,87,0.35)] hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 transition inline-flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="opacity-90" />
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
