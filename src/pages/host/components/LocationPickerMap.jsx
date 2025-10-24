import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons in many bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en&email=you@example.com`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocoding failed");
  const data = await res.json();
  return data.display_name || "";
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click: (e) => onPick(e.latlng),
  });
  return null;
}

export default function LocationPickerMapString({
  address,                 // string value from parent
  onAddressChange,         // (string) => void
  defaultCenter = { lat: 12.8797, lng: 121.7740 }, // Philippines
  defaultZoom = 5,
}) {
  const [pos, setPos] = useState(null);
  const center = useMemo(() => (pos ? pos : defaultCenter), [pos, defaultCenter]);

  const handlePick = async ({ lat, lng }) => {
    setPos({ lat, lng });
    try {
      const display = await reverseGeocode(lat, lng);
      onAddressChange?.(display);
    } catch {
      onAddressChange?.("");
    }
  };

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/30 shadow-md">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={pos ? 14 : defaultZoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        {pos && (
          <Marker
            position={[pos.lat, pos.lng]}
            draggable
            eventHandlers={{
              dragend: async (e) => {
                const { lat, lng } = e.target.getLatLng();
                await handlePick({ lat, lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
