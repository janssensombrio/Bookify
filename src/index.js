import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PayPalScriptProvider options={{ "client-id": "AeGyRkCA23qcmw8JVXkeaoXNphvKx2OByRLLVlJJUBFFniNJ8eE2MXnymDT8DEKVdhIh8ZacuxieCmxK", currency: "PHP" }}>
      <App />
    </PayPalScriptProvider>
  </React.StrictMode>
);

reportWebVitals();