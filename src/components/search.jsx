import React, { useState } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale"; // optional
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";

import './styles/search.css';

function Search() {
  const [range, setRange] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: "selection",
    },
  ]);

  return (
    <div className="search-wrapper">
      <div className="search-place">
        <label>Where</label>
        <input type="text" placeholder="Search destinations" required />
      </div>

      <div className="date-field">
        <label>When</label>
        <div className="calendar-wrapper">
            <DateRange
            editableDateInputs={true}
            onChange={item => setRange([item.selection])}
            moveRangeOnFirstSelection={false}
            ranges={range}
            minDate={new Date()}
            locale={enUS} // optional, prevents localize error
            />
        </div>
      </div>

      <div className="num-guest">
        <label>Who</label>
        <div className="guest-types">
          <label>Adults</label>
          <input type="number" min="0" />
          <label>Children</label>
          <input type="number" min="0" />
          <label>Infant</label>
          <input type="number" min="0" />
        </div>
      </div>
    </div>
  );
}

export default Search;
