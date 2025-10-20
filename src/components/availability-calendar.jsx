import React, { useState, useEffect } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

function AvailabilityCalendar({ availability, onDateChange }) {
  // Range used by react-date-range
  const [range, setRange] = useState([
    {
      startDate: null,
      endDate: null,
      key: "selection",
    },
  ]);

  useEffect(() => {
    if (availability?.start && availability?.end) {
      const start = new Date(availability.start);
      const end = new Date(availability.end);

      setRange([{ startDate: start, endDate: end, key: "selection" }]);
    } else {
      setRange([{ startDate: null, endDate: null, key: "selection" }]);
    }
  }, [availability]);

  // Disable dates outside of availability range
  const isDateDisabled = (date) => {
    if (!availability?.start || !availability?.end) return false;
    const start = new Date(availability.start);
    const end = new Date(availability.end);
    return date < start || date > end;
  };

  const handleSelect = (item) => {
    setRange([item.selection]);

    if (onDateChange) {
      const { startDate, endDate } = item.selection;
      if (startDate && endDate) {
        onDateChange({ start: startDate, end: endDate });
      } else {
        onDateChange({ start: null, end: null });
      }
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
      <DateRange
        editableDateInputs={false}
        onChange={handleSelect}
        ranges={range}
        minDate={availability?.start ? new Date(availability.start) : undefined}
        maxDate={availability?.end ? new Date(availability.end) : undefined}
        locale={enUS}
        moveRangeOnFirstSelection={false}
        showSelectionPreview={true}
        disabledDay={isDateDisabled}
        months={1}
        direction="horizontal"
      />
    </div>
  );
}

export default AvailabilityCalendar;
