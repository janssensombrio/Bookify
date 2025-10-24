import React, { useState } from "react";
import {
  Modal,
  Box,
  Typography,
  Button,
  IconButton,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export const PolicyComplianceModal = ({
  open = false,
  onClose = () => {},
  onConfirm = () => {},
}) => {
  const [agreed, setAgreed] = useState(false);

  const handleConfirm = () => {
    if (!agreed) {
      alert("Please agree to the policies before publishing.");
      return;
    }
    onConfirm();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520,
          bgcolor: "background.paper",
          p: 4,
          borderRadius: 2,
          boxShadow: 24,
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>

        {/* Header */}
        <Typography variant="h6" color="primary" fontWeight={600} mb={2}>
          Policy & Compliance
        </Typography>

        {/* Content */}
        <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
          Before publishing your listing, please review and acknowledge the following:
        </Typography>

        <Typography variant="subtitle1" fontWeight={600}>
          🧾 Listing Accuracy
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Ensure all information in your listing (such as pricing, location, and
          amenities) is accurate and up to date. Misleading or false listings may
          result in suspension or removal.
        </Typography>

        <Typography variant="subtitle1" fontWeight={600}>
          🏡 Host Responsibilities
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          As a host, you are responsible for maintaining a safe, clean, and welcoming
          environment for guests. Any safety hazards or violations of local laws must
          be disclosed.
        </Typography>

        <Typography variant="subtitle1" fontWeight={600}>
          🚫 Cancellations & Refunds
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Your cancellation policy must be clearly stated. Sudden cancellations
          without valid reasons may affect your reliability rating and visibility on
          the platform.
        </Typography>

        <Typography variant="subtitle1" fontWeight={600}>
          ⚖️ Legal & Compliance
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          You must comply with local regulations, safety standards, and community
          policies. Listings violating laws or terms of service will be taken down.
        </Typography>

      </Box>
    </Modal>
  );
};
