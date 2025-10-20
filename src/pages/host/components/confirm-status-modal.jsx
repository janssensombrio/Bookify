// ConfirmStatusModal.jsx
import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@mui/material";

export default function ConfirmStatusModal({ open, onClose, onConfirm, newStatus, listingTitle }) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle sx={{ pb: 2 }}>Confirm {newStatus === "draft" ? "draft" : "publish "}</DialogTitle>
      <DialogContent sx={{ p: 4 }}> {/* Adds proper padding */}
        <Typography>
          Are you sure you want to {newStatus === "draft" ? `save this ${listingTitle} as draft` : `publish ${listingTitle}`} 
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 4, pb: 2 }}> {/* Optional padding for buttons */}
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button onClick={onConfirm} color={newStatus === "draft" ? "warning" : "success"} variant="contained">
          {newStatus === "draft" ? "Save as Draft" : "Publish"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
