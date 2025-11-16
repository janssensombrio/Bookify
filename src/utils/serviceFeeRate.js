// Utility to fetch service fee rate from admin settings
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useState, useEffect } from "react";
import { database } from "../config/firebase";

const DEFAULT_RATES = {
  homes: 10, // 10%
  experiences: 20, // 20%
  services: 12, // 12%
};

/**
 * Get service fee rate for a category
 * @param {string} category - "Homes", "Experiences", or "Services"
 * @returns {Promise<number>} Service fee rate as a decimal (e.g., 0.1 for 10%)
 */
export async function getServiceFeeRate(category) {
  try {
    const settingsRef = doc(database, "settings", "hostPolicies");
    const snap = await getDoc(settingsRef);
    
    if (snap.exists()) {
      const data = snap.data();
      const cat = (category || "").toLowerCase();
      
      if (cat.startsWith("home")) {
        const rate = Number(data.serviceFeeHomes ?? DEFAULT_RATES.homes);
        return rate / 100; // Convert percentage to decimal
      } else if (cat.startsWith("experience")) {
        const rate = Number(data.serviceFeeExperiences ?? DEFAULT_RATES.experiences);
        return rate / 100;
      } else if (cat.startsWith("service")) {
        const rate = Number(data.serviceFeeServices ?? DEFAULT_RATES.services);
        return rate / 100;
      }
    }
  } catch (error) {
    console.error("Error fetching service fee rate:", error);
  }
  
  // Fallback to defaults
  const cat = (category || "").toLowerCase();
  if (cat.startsWith("home")) return DEFAULT_RATES.homes / 100;
  if (cat.startsWith("experience")) return DEFAULT_RATES.experiences / 100;
  if (cat.startsWith("service")) return DEFAULT_RATES.services / 100;
  
  return DEFAULT_RATES.homes / 100; // Default fallback
}

/**
 * React hook to get service fee rate with real-time updates
 * @param {string} category - "Homes", "Experiences", or "Services"
 * @returns {number} Service fee rate as a decimal
 */
export function useServiceFeeRate(category) {
  const [rate, setRate] = useState(() => {
    const cat = (category || "").toLowerCase();
    if (cat.startsWith("home")) return DEFAULT_RATES.homes / 100;
    if (cat.startsWith("experience")) return DEFAULT_RATES.experiences / 100;
    if (cat.startsWith("service")) return DEFAULT_RATES.services / 100;
    return DEFAULT_RATES.homes / 100;
  });

  useEffect(() => {
    const settingsRef = doc(database, "settings", "hostPolicies");
    const unsubscribe = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const cat = (category || "").toLowerCase();
        
        if (cat.startsWith("home")) {
          const rateValue = Number(data.serviceFeeHomes ?? DEFAULT_RATES.homes);
          setRate(rateValue / 100);
        } else if (cat.startsWith("experience")) {
          const rateValue = Number(data.serviceFeeExperiences ?? DEFAULT_RATES.experiences);
          setRate(rateValue / 100);
        } else if (cat.startsWith("service")) {
          const rateValue = Number(data.serviceFeeServices ?? DEFAULT_RATES.services);
          setRate(rateValue / 100);
        }
      }
    }, (error) => {
      console.error("Error subscribing to service fee rate:", error);
    });

    return () => unsubscribe();
  }, [category]);

  return rate;
}

