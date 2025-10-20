import React, { useState } from "react";
import { DateRange } from "react-date-range";
import { enUS } from "date-fns/locale";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import {
  Box,
  TextField,
  Button,
  Popover,
  Typography,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PeopleIcon from "@mui/icons-material/People";
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

function Search() {
  const [range, setRange] = useState([
    { startDate: new Date(), endDate: new Date(), key: "selection" },
  ]);
  const [destination, setDestination] = useState("");
  const [guests, setGuests] = useState({ adults: 0, children: 0, infants: 0 });
  const [dateAnchor, setDateAnchor] = useState(null);
  const [guestAnchor, setGuestAnchor] = useState(null);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 1, // smaller gaps on mobile
        p: { xs: 2, md: 4 },
        borderRadius: 4,
        boxShadow: 3,
        backgroundColor: "background.paper",
        maxWidth: { xs: "68%", md: 900 },
        mx: "auto",
      }}
    >
      {/* Destination */}
      <TextField
        placeholder="Where are you going?"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        sx={{
          flex: { xs: "unset", md: 1 },
          width: { xs: "100%", md: "auto" },
          mb: { xs: 1, md: 0 },
        }}
      />

      {/* Date */}
      <Button
        variant="outlined"
        startIcon={<CalendarTodayIcon />}
        onClick={(e) => setDateAnchor(e.currentTarget)}
        sx={{
          flex: { xs: "unset", md: 1 },
          width: { xs: "100%", md: "auto" },
          justifyContent: "space-between",
          textTransform: "none",
          mb: { xs: 1, md: 0 },
        }}
      >
        {`${range[0].startDate.toLocaleDateString()} - ${range[0].endDate.toLocaleDateString()}`}
      </Button>

      {/* Guests */}
      <Button
        variant="outlined"
        startIcon={<PeopleIcon />}
        onClick={(e) => setGuestAnchor(e.currentTarget)}
        sx={{
          flex: { xs: "unset", md: 1 },
          width: { xs: "100%", md: "auto" },
          justifyContent: "space-between",
          textTransform: "none",
          mb: { xs: 1, md: 0 },
        }}
      >
        {`Guests: ${guests.adults + guests.children + guests.infants}`}
      </Button>

      {/* Search Button */}
      <Button
        variant="contained"
        color="primary"
        startIcon={<SearchRoundedIcon />}
        sx={{
          borderRadius: 2,
          textTransform: "none",
          width: { xs: "100%", md: "auto" }, // full width on mobile
        }}
      >
        Search
      </Button>

      {/* Popovers */}
      <Popover
        open={Boolean(dateAnchor)}
        anchorEl={dateAnchor}
        onClose={() => setDateAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <DateRange
          editableDateInputs
          onChange={(item) => setRange([item.selection])}
          moveRangeOnFirstSelection={false}
          ranges={range}
          minDate={new Date()}
          locale={enUS}
        />
      </Popover>

      <Popover
        open={Boolean(guestAnchor)}
        anchorEl={guestAnchor}
        onClose={() => setGuestAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          {["adults", "children", "infants"].map((type) => (
            <Box key={type} sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ textTransform: "capitalize" }}>{type}</Typography>
              <TextField
                type="number"
                size="small"
                inputProps={{ min: 0 }}
                value={guests[type]}
                onChange={(e) =>
                  setGuests({ ...guests, [type]: Number(e.target.value) })
                }
                sx={{ width: 60 }}
              />
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}

export default Search;
