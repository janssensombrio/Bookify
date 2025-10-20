import React, { useEffect, useRef } from "react";

const PayPalButton = ({ amount, onSuccess }) => {
  const paypalRef = useRef();

  useEffect(() => {
    if (!window.paypal) return;

    window.paypal
      .Buttons({
        style: {
          color: "gold",
          shape: "pill",
          label: "pay",
        },
        // Create PayPal order
        createOrder: (data, actions) => {
          return actions.order.create({
            purchase_units: [
              {
                amount: {
                  value: amount.toFixed(2),
                  currency_code: "PHP",
                },
              },
            ],
          });
        },
        // When payment is approved
        onApprove: async (data, actions) => {
          const details = await actions.order.capture();
          console.log("Payment successful:", details);
          onSuccess(details);
        },
        // If payment is canceled or fails
        onError: (err) => {
          console.error("PayPal Error:", err);
          alert("Payment failed. Please try again.");
        },
      })
      .render(paypalRef.current);
  }, [amount, onSuccess]);

  return <div ref={paypalRef}></div>;
};

export default PayPalButton;
