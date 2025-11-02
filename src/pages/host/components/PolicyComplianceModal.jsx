import React, { useEffect, useRef, useState } from "react";
import { X, ShieldCheck, Info, CheckCircle, FileText } from "lucide-react";

function PolicyComplianceModal({ open = false, onClose = () => {}, onConfirm = () => {} }) {
  const [agreed, setAgreed] = useState(false);
  const initialFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const t = setTimeout(() => initialFocusRef.current?.focus(), 0);

    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!agreed) {
      alert("Please agree to the policies before publishing.");
      return;
    }
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999]">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="relative mx-auto h-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[36rem]">
          <div className="relative rounded-2xl p-[1px] bg-gradient-to-br from-blue-500/40 via-indigo-500/30 to-purple-500/30 shadow-[0_30px_80px_rgba(30,58,138,0.35)]">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="pcm-title"
              className="relative rounded-2xl bg-white/90 backdrop-blur-xl ring-1 ring-white/40 shadow-[0_8px_24px_rgba(17,24,39,0.12),_0_20px_60px_rgba(30,58,138,0.18)]"
            >
              <div
                className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 [mask-image:linear-gradient(to_bottom,white,transparent)]"
                style={{
                  background:
                    "radial-gradient(1200px 200px at 50% -20%, rgba(255,255,255,.8), transparent)",
                }}
              />
              <div className="px-5 sm:px-7 pt-5 sm:pt-6 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden />
                    <h2 id="pcm-title" className="text-lg sm:text-xl font-semibold text-slate-900">
                      Policy &amp; Compliance
                    </h2>
                  </div>
                  <button
                    ref={initialFocusRef}
                    onClick={onClose}
                    className="group inline-flex items-center justify-center h-9 w-9 rounded-full border border-slate-200/70 bg-white/70 text-slate-600 hover:text-slate-900 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="mt-3 text-sm text-slate-600">
                  Before publishing your listing, please review and acknowledge the following:
                </p>

                <div className="mt-4 grid gap-4">
                  <section className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" /> Listing Accuracy
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Ensure all information in your listing (such as pricing, location, and amenities) is
                      accurate and up to date. Misleading or false listings may result in suspension or
                      removal.
                    </p>
                  </section>

                  <section className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-indigo-600" /> Host Responsibilities
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      As a host, you are responsible for maintaining a safe, clean, and welcoming environment
                      for guests. Any safety hazards or violations of local laws must be disclosed.
                    </p>
                  </section>

                  <section className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <Info className="h-4 w-4 text-indigo-600" /> Cancellations &amp; Refunds
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Your cancellation policy must be clearly stated. Sudden cancellations without valid
                      reasons may affect your reliability rating and visibility on the platform.
                    </p>
                  </section>

                  <section className="rounded-xl border border-slate-200/70 bg-white/70 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-indigo-600" /> Legal &amp; Compliance
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      You must comply with local regulations, safety standards, and community policies.
                      Listings violating laws or terms of service will be taken down.
                    </p>
                  </section>
                </div>
              </div>
            </div>
          </div>
          {/* Click-outside to close (optional): handled by backdrop in parent container */}
        </div>
      </div>
    </div>
  );
}

export default PolicyComplianceModal;
