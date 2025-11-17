// src/components/PointsNotificationModal.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

const PointsNotificationModal = ({ open, onClose, points, reason, title }) => {
  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[2147483647] px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="bg-white rounded-2xl w-full max-w-md p-6 sm:p-8 relative shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-400" />
            </button>
            
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                <Sparkles size={40} className="text-amber-600" />
              </div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                {title || "Points Earned!"}
              </h3>
              
              <div className="mb-4">
                <div className="text-5xl font-bold text-amber-600 mb-2">
                  +{points}
                </div>
                <div className="text-sm text-gray-500">points</div>
              </div>
              
              {reason && (
                <p className="text-gray-600 text-sm mb-6">
                  {reason}
                </p>
              )}
              
              <button
                onClick={onClose}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition shadow-md"
              >
                Awesome!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PointsNotificationModal;

