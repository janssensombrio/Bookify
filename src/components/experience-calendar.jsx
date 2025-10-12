import React, { useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

function ExperienceCalendar({ availability, onDateChange }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);

  const isDateSelectable = (date) => {
    if (!availability || availability.length === 0) return true;
    const dateStr = date.toISOString().split("T")[0];
    return availability.some(item => item.date === dateStr);
  };

  const handleDateChange = (date) => {
    if (!isDateSelectable(date)) return;
    setSelectedDate(date);
    setSelectedTime(null); // reset time when date changes
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    onDateChange({
      selectedDate: selectedDate.toISOString().split("T")[0],
      selectedTime: time
    });
  };

  const timesForSelectedDate = selectedDate
    ? availability
        .filter(item => item.date === selectedDate.toISOString().split("T")[0])
        .map(item => item.time)
    : [];

  const tileDisabled = ({ date }) => !isDateSelectable(date);

  return (
    <div>
      <Calendar
        onChange={handleDateChange}
        value={selectedDate}
        tileDisabled={tileDisabled}
      />

      {selectedDate && timesForSelectedDate.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <strong>Select Time:</strong>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "5px" }}>
            {timesForSelectedDate.map(time => (
              <button
                key={time}
                onClick={() => handleTimeSelect(time)}
                style={{
                  padding: "5px 10px",
                  background: time === selectedTime ? "#007bff" : "#f0f0f0",
                  color: time === selectedTime ? "white" : "black",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {time}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExperienceCalendar;