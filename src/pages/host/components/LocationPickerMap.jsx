import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

// If you haven't globally imported it already
// import "leaflet/dist/leaflet.css";

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

async function reverseGeocode(lat, lng, contactEmail) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en&email=${encodeURIComponent(
      contactEmail || "you@example.com"
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.display_name || null; // return null (not coords) on failure
  } catch {
    return null;
  }
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

/**
 * LocationPickerMapString
 *
 * Props:
 * - onAddressChange?: (address: string) => void     // called only with a readable address
 * - onPositionChange?: ({lat, lng}) => void         // coordinates always reported here
 * - initialCoords?: { lat: number, lng: number }    // optional initial pin
 * - defaultCenter?: { lat: number, lng: number }    // fallback map center
 * - defaultZoom?: number
 * - heightClass?: string                            // Tailwind height class for wrapper
 * - contactEmail?: string                           // passed to Nominatim
 */
export default function LocationPickerMapString({
  onAddressChange,
  onPositionChange,
  initialCoords = null,
  defaultCenter = { lat: 12.8797, lng: 121.774 },
  defaultZoom = 5,
  heightClass = "h-[420px]",
  contactEmail = "you@example.com",
}) {
  const [pos, setPos] = useState(initialCoords);

  // If parent provides/updates initialCoords (e.g., editing a draft), reflect it
  useEffect(() => {
    if (
      initialCoords &&
      (!pos || pos.lat !== initialCoords.lat || pos.lng !== initialCoords.lng)
    ) {
      setPos(initialCoords);
    }
  }, [initialCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  const center = useMemo(() => pos || defaultCenter, [pos, defaultCenter]);

  const handlePick = async ({ lat, lng }) => {
    setPos({ lat, lng });
    onPositionChange?.({ lat, lng });

    const display = await reverseGeocode(lat, lng, contactEmail);
    if (display) {
      onAddressChange?.(display);
    }
    // If no display name, we intentionally DO NOT overwrite the text field.
  };

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-white/30 shadow-md ${heightClass}`}
    >
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={pos ? 14 : defaultZoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
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
