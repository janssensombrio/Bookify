import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";
L.Icon.Default.mergeOptions({ iconRetinaUrl: marker2x, iconUrl: marker, shadowUrl: shadow });

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <PayPalScriptProvider options={{ "client-id": "AeGyRkCA23qcmw8JVXkeaoXNphvKx2OByRLLVlJJUBFFniNJ8eE2MXnymDT8DEKVdhIh8ZacuxieCmxK", currency: "PHP" }}>
      <App />
    </PayPalScriptProvider>
  </React.StrictMode>
);

reportWebVitals();