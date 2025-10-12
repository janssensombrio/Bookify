import React, { useState, useEffect } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale"; 
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

function AvailabilityCalendar({ availability, onDateChange }) {
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

  // inside AvailabilityCalendar
  const isDateDisabled = (date) => {
    if (!availability || !Array.isArray(availability)) return false;
    const availableDates = availability.map(d => new Date(d.date).toDateString());
    return !availableDates.includes(date.toDateString());
  };

  // Handle date selection and pass it to parent
  const handleSelect = (item) => {
    setRange([item.selection]);
    
    // Pass selected dates back to parent component
    if (onDateChange && item.selection.startDate && item.selection.endDate) {
      // Only send if both dates are selected and different
      if (item.selection.startDate.getTime() !== item.selection.endDate.getTime()) {
        onDateChange({
          checkIn: item.selection.startDate.toISOString().split('T')[0],
          checkOut: item.selection.endDate.toISOString().split('T')[0]
        });
      }
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
      <DateRange
        editableDateInputs={false}
        onChange={handleSelect}
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