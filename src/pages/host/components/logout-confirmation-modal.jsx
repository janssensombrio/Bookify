// LogoutModal.jsx
import React from "react";
import '../styles/logout-confirmation-modal.css';

function LogoutConfirmationModal({ isOpen, onClose, onLogout }) {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay">
      <div className="logout-modal-content">
        <h2>Confirm Logout</h2>
        <p>Are you sure you want to log out?</p>
        <div className="logout-modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
    </div>
  );
}

export default LogoutConfirmationModal;
