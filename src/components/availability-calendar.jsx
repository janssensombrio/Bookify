import React, { useState, useEffect } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale"; 
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

function AvailabilityCalendar({ availability }) {
  const [range, setRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: "selection",
    },
  ]);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  useEffect(() => {
    if (availability?.start && availability?.end) {
      const start = new Date(availability.start);
      const end = new Date(availability.end);
      // Only set the min/max bounds, not the selected range
      setStartDate(start);
      setEndDate(end);
    }
  }, [availability]);

  // disable dates outside availability
  const isDateDisabled = (date) => {
    return date < startDate || date > endDate;
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
      <DateRange
        editableDateInputs={false}
        onChange={(item) => setRange([item.selection])}
        ranges={range}
        minDate={startDate}
        maxDate={endDate}
        locale={enUS}
        moveRangeOnFirstSelection={false}
        showSelectionPreview={true}
        disabledDay={isDateDisabled}
        months={2}
        direction="horizontal"
      />
    </div>
  );
}

export default AvailabilityCalendar;