// DeleteConfirmationModal.jsx
import React from "react";
import '../styles/delete-confirmation-modal.css';

function DeleteConfirmationModal({ isOpen, onClose, onDelete, itemName = "this item" }) {
  if (!isOpen) return null;

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal-content">
        <h2>Confirm Delete</h2>
        <p>Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.</p>
        <div className="delete-modal-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="delete-btn" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmationModal;
