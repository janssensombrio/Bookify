import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Fade,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { database, auth } from "../config/firebase";

export const MessageHostModal = ({ open = false, onClose = () => {}, hostId }) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("You must be logged in to send messages");

      await addDoc(collection(database, "messages"), {
        senderId: currentUser.uid,
        receiverId: hostId,
        message: message.trim(),
        timestamp: serverTimestamp(),
      });

      setSent(true);
    } catch (err) {
      console.error(err);
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "background.paper",
            p: 3,
            borderRadius: 2,
            boxShadow: 24,
          }}
        >
          <IconButton
            onClick={onClose}
            sx={{ position: "absolute", top: 8, right: 8 }}
          >
            <CloseIcon />
          </IconButton>

          {!sent ? (
            <>
              <Typography variant="h6" gutterBottom>
                Message Host
              </Typography>
              <TextField
                multiline
                rows={4}
                fullWidth
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
                <Button onClick={onClose} disabled={sending}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={handleSend} disabled={sending}>
                  {sending ? "Sending..." : "Send"}
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                Message Sent!
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2, gap: 1 }}>
                <Button onClick={onClose}>Close</Button>
                <Button
                  variant="contained"
                  onClick={() => window.location.href = "/messages"}
                >
                  Go to Messages
                </Button>
              </Box>
            </>
          )}
        </Box>
    </Modal>
  );
};
