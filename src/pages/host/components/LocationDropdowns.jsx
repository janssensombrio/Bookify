import React, { useState, useEffect } from "react";

export default function LocationDropdowns() {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedMunicipality, setSelectedMunicipality] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");

  // Fetch all regions on load
  useEffect(() => {
    fetch("https://ph-locations-api.example.com/regions")
      .then((res) => res.json())
      .then((data) => setRegions(data));
  }, []);

  // Fetch provinces or municipalities depending on NCR
  useEffect(() => {
    if (!selectedRegion) return;

    if (selectedRegion === "NCR") {
      // NCR has no provinces, fetch municipalities instead
      fetch(`https://ph-locations-api.example.com/regions/${selectedRegion}/municipalities`)
        .then((res) => res.json())
        .then((data) => {
          setProvinces([]); // no provinces
          setMunicipalities(data);
          setBarangays([]);
        });
    } else {
      // Normal regions: fetch provinces
      fetch(`https://ph-locations-api.example.com/regions/${selectedRegion}/provinces`)
        .then((res) => res.json())
        .then((data) => {
          setProvinces(data);
          setMunicipalities([]);
          setBarangays([]);
        });
    }

    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedBarangay("");
  }, [selectedRegion]);

  // Fetch municipalities when a province is selected
  useEffect(() => {
    if (!selectedProvince) return;

    fetch(`https://ph-locations-api.example.com/provinces/${selectedProvince}/municipalities`)
      .then((res) => res.json())
      .then((data) => {
        setMunicipalities(data);
        setBarangays([]);
      });

    setSelectedMunicipality("");
    setSelectedBarangay("");
  }, [selectedProvince]);

  // Fetch barangays when a municipality is selected
  useEffect(() => {
    if (!selectedMunicipality) return;

    fetch(`https://ph-locations-api.example.com/municipalities/${selectedMunicipality}/barangays`)
      .then((res) => res.json())
      .then((data) => setBarangays(data));

    setSelectedBarangay("");
  }, [selectedMunicipality]);

  return (
    <div>
      {/* Region Dropdown */}
      <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
        <option value="">Select Region</option>
        {regions.map((r) => (
          <option key={r.code} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>

      {/* Province Dropdown */}
      {selectedRegion !== "NCR" && (
        <select value={selectedProvince} onChange={(e) => setSelectedProvince(e.target.value)}>
          <option value="">Select Province</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {/* Municipality Dropdown */}
      <select value={selectedMunicipality} onChange={(e) => setSelectedMunicipality(e.target.value)}>
        <option value="">Select Municipality/City</option>
        {municipalities.map((m) => (
          <option key={m.code} value={m.name}>
            {m.name}
          </option>
        ))}
      </select>

      {/* Barangay Dropdown */}
      <select value={selectedBarangay} onChange={(e) => setSelectedBarangay(e.target.value)}>
        <option value="">Select Barangay</option>
        {barangays.map((b) => (
          <option key={b.code} value={b.name}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
