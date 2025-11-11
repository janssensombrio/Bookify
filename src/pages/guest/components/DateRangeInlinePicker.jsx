import { useMemo } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/bookify-calendar.css";

function toDate(ymd) { return ymd ? new Date(`${ymd}T00:00:00`) : null; }
function toYMD(d) {
  if (!d || isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * value: { start: "YYYY-MM-DD" | "", end: "YYYY-MM-DD" | "" }
 * onChange: (next: { start: string, end: string }) => void
 */
export default function DateRangePickerInline({
  value = { start: "", end: "" },
  onChange,
  minDate = new Date(),
  monthsShown = 2,
  calendarClassName = "bookify-calendar",
  excludeDateIntervals,           // array of {start: Date, end: Date}
  selectsDisabledDaysInRange = false,
  filterDate,                     // (date: Date) => boolean
  ...rest
}) {
  const startDate = useMemo(() => toDate(value.start), [value.start]);
  const endDate   = useMemo(() => toDate(value.end),   [value.end]);

  const handleChange = (dates) => {
    const [s, e] = dates || [];
    onChange?.({ start: s ? toYMD(s) : "", end: e ? toYMD(e) : "" });
  };

  return (
    <DatePicker
      inline
      selectsRange
      startDate={startDate}
      endDate={endDate}
      onChange={handleChange}
      minDate={minDate}
      monthsShown={monthsShown}
      shouldCloseOnSelect={false}
      calendarClassName={calendarClassName}
      excludeDateIntervals={excludeDateIntervals}
      selectsDisabledDaysInRange={selectsDisabledDaysInRange}
      filterDate={filterDate}
      {...rest}
    />
  );
}
