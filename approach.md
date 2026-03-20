## 1. `/uuid` — UUID Utility Interface

### 🔹 Layout

Use a **tab-based UI** with 2 tabs:

### **Tab 1: Generate UUID**

**Purpose:** Generate random UUIDs

**UI Elements:**

- Button: `Generate UUID`
- Output field (readonly text box)
- Copy button

**Behavior:**

- On click → generate UUID using `google/uuid`
- Display instantly
- Allow copy to clipboard

**Enhancements:**

- Option toggle:
  - UUID v4 (default)
  - UUID v1 (optional, if needed)
- Auto-generate toggle (optional)

---

### **Tab 2: UUID Converter**

**Purpose:** Convert between string ↔ UUID

**UI Elements:**

- Input field (string / UUID)
- Two buttons:
  - `String → UUID`
  - `UUID → String`
- Output field
- Validation message area

**Behavior:**

- Validate input before conversion
- Show error for invalid UUID format
- Conversion logic:
  - String → UUID: hash-based or namespace UUID (define method clearly)
  - UUID → String: return canonical string format

**Important Design Decision:**

- UUID is already a string format → clarify conversion type:
  - If meaning binary ↔ string → specify encoding (hex/base64)
  - If meaning deterministic UUID → use namespace UUID (v5)

---

## 2. `/epoch-converter` — Time Utility Interface

**Product goal:** Match the **core and extended tools** users expect from [Epoch Converter](https://www.epochconverter.com/) (Unix timestamp ↔ human date, live clock, multi-unit support, timezone tools, batch and niche formats). Implement as one hub with **clear navigation** (tabs, sidebar, or sub-routes) so the page does not feel overloaded.

**Reference capabilities** (from [epochconverter.com](https://www.epochconverter.com/)) to cover:

| Area | Reference feature | Notes for implementation |
| --- | --- | --- |
| Core | Current Unix epoch (live) | Already in Section 1; add **seconds + ms** (and copy). |
| Core | Timestamp → readable date | Section 3; units: **s, ms, µs, ns**. |
| Core | Readable date → timestamp | Flexible parsing (RFC 2822, ISO, D-M-Y, M/D/Y, Y-M-D, etc.). |
| Core | GMT vs local for inputs | Preference + per-form override. |
| Core | Preferences | Locale, 12h/24h, default TZ, date order, theme, “clear all”. |
| Utility | Start/end of year, month, day | Section 5. |
| Utility | Seconds → years/months/days/h/m | Section 6 (document approximations, e.g. month length). |
| Utility | Batch converter | Many lines in → table out (Section 7). |
| Utility | Timestamp list | Generate lists by month/year (Section 8). |
| Utility | Time zone converter | Section 2 (IANA list). |
| Specialized | LDAP, .NET ticks, GPS, Julian, WebKit, hex Unix, Cocoa, HFS+, NTP, FAT, SAS, Excel OADate, since year 0, Bin/Oct/Hex | Section 9 (document formula + epoch for each). |
| Education | Year 2038 countdown / explainer | Section 10. |
| UX | Epoch clock, dark theme, keyboard shortcuts | Align with Section 1 + preferences. |

**Disclaimer parity:** Reference site notes: conversions use **client clock** and **JavaScript**; **leap seconds** are not modeled; some browsers apply **current DST rules** to historical dates — state the same limits in help text.

### 🔹 Layout Sections

---

## **Section 1: Current Time Display**

**UI Elements:**

- Analog Clock (optional but good UX)
- Digital Clock:
  - 12-hour format (AM/PM)
  - 24-hour format
- **Live Unix Timestamp (UTC)** (“epoch clock”):
  - Running value in **seconds** and/or **milliseconds** (toggle or show both)
  - Auto-updates every second (or every 100ms for ms display)
  - Copy button(s) for quick copy-to-clipboard
- Label: Current Timezone (default: UTC)

**Behavior:**

- Auto-update every second
- Default timezone = UTC

---

## **Section 2: Timezone Converter**

**UI Elements:**

- Dropdown: Timezone selector
  - Use full IANA timezone list (e.g., `Asia/Kolkata`, `America/New_York`)
- Button: `Convert Time`
- Output display:
  - Converted time (12h + 24h)
  - Selected timezone label

**Behavior:**

- On selection + click:
  - Convert current UTC time → selected timezone
- No page reload

---

## **Section 3: Epoch Converter**

**Purpose:** Turn a numeric Unix-style value into **human-readable date and time** (and the reverse).

**UI Elements:**

- **Input:** numeric field for the timestamp (e.g. `996322350`)
- **Unit selector** (required — user chooses what the number means):
  - **Seconds** (Unix epoch, whole or fractional)
  - **Milliseconds**
  - **Microseconds** (parity with [epochconverter.com](https://www.epochconverter.com/))
  - **Nanoseconds** (e.g. `996322350` = nanoseconds since Unix epoch → normalize to UTC instant, then format)
- Button: `Convert`
- **Output (human-readable execution time):**
  - Full datetime string (UTC)
  - Same instant in **selected timezone** (reuse Section 2 timezone if present, or a local dropdown)
  - Optional: ISO 8601 line for copy/paste
- **Validation:** reject non-numeric input; show a clear error if the value is out of range after conversion

**Behavior:**

- Interpret the input **only** according to the selected unit (same digits, different meaning — e.g. `996322350` as nanoseconds vs milliseconds must produce different results).
- Convert to a single UTC instant, then format with `Intl` (no manual offset math).
- **JavaScript note:** `Date` is millisecond-based; for **µs/ns** use division to ms and **`BigInt`** when values exceed safe integer; document sub-millisecond display limits in the UI.

**Reverse Conversion:**

- Input: date/time picker (and timezone context)
- Output: epoch in **seconds**, **milliseconds**, **microseconds**, or **nanoseconds** (match Section 3 unit options)
- **Date text input:** accept common formats (RFC 2822, ISO 8601, D-M-Y, M/D/Y, Y-M-D, etc.); optional hint: strip `GMT` / normalize whitespace per reference behavior

**Example:**

- Input: `996322350` + unit **Nanoseconds** → treat as nanoseconds since `1970-01-01T00:00:00.000Z`, show human-readable UTC (and selected TZ).
- Same input with unit **Milliseconds** → different instant; UI must make the active unit obvious so users do not mix them up.

---

## **Section 4: Global Preferences**

*(Matches [Epoch Converter preferences](https://www.epochconverter.com/) — persist locally, e.g. `localStorage`.)*

- **Locale / date output:** autodetect or fixed (affects formatted strings via `Intl`).
- **Clock:** 12-hour (AM/PM) vs 24-hour default for displays.
- **Default timezone for inputs:** UTC/GMT vs “local” (browser).
- **Preferred date input order:** Y-M-D (ISO), M/D/Y (US), D-M-Y.
- **Theme:** light / dark / follow device.
- **Shortcuts:** e.g. **C** to clear all forms (optional).
- **“Clear form”** on each major tool.

---

## **Section 5: Period Boundaries (Start / End of Year, Month, Day)**

- User picks calendar date or uses “today”.
- Show **start** and **end** of selected **year**, **month**, or **day** as:
  - Human-readable (GMT/local per preference)
  - Epoch in **s / ms / µs / ns** (copyable)
- Optional link to **timestamp list** (Section 8) for the chosen period.

---

## **Section 6: Seconds → Duration Breakdown**

- Input: duration in **seconds** (integer or decimal).
- Output: approximate **years, months, days, hours, minutes** (and seconds).
- Document that “month/year” are **approximate** (reference uses ~30.44 days/month, ~365.25 days/year style breakdowns — match or state your constants in UI help).

---

## **Section 7: Batch Converter**

- Input: **multiple lines** of timestamps (mixed units only if clearly labeled per line or single global unit).
- Output: **table** — raw value, interpreted instant (UTC + local/TZ), ISO 8601, copy row.
- Handle errors per line without failing the whole batch.

---

## **Section 8: Timestamp List**

- Generate a **list** of timestamps for a chosen **month** or **year** (or custom range), at a chosen resolution (e.g. daily, hourly).
- Export: copy as text or CSV (optional).
- Useful for testing, logs, and scheduling (parity with reference “list months & years” tool).

---

## **Section 9: Specialized Timestamp Formats**

Each tool: **input number** (and base if hex/oct/bin) → **UTC instant** + human-readable; reverse where meaningful. **Document the formula** in-app (tooltip or “?” panel).

| Tool | Purpose (high level) |
| --- | --- |
| **Unix hex** | Hex string ↔ Unix instant (seconds or ms — specify). |
| **Bin / Oct / Hex** | Integer epoch in binary/octal/hex ↔ decimal epoch ↔ date. |
| **LDAP / Windows FILETIME** | 100-ns intervals since 1601-01-01 UTC (common AD/LDAP). |
| **.NET `DateTime` ticks** | Ticks since 0001-01-01 (specify calendar assumptions). |
| **GPS time** | GPS week + seconds of week ↔ UTC (account for leap seconds in docs). |
| **Julian Day** | Julian day number ↔ civil date/time. |
| **Chrome / WebKit** | Microseconds since `1601-01-01` (Windows epoch) — verify constant in spec. |
| **Cocoa / Core Data** | Seconds since `2001-01-01` (Apple reference date). |
| **Mac HFS+** | HFS+ date encoding (seconds since 1904-01-01 or per Apple spec). |
| **NTP** | NTP 64-bit timestamp format ↔ UTC. |
| **FAT** | FAT date/time bit-packed fields ↔ civil time. |
| **SAS** | SAS datetime value ↔ civil time. |
| **Excel / OLE Automation date** | Serial date (OADate) ↔ civil time (document 1900 leap-year bug behavior if emulating Excel). |
| **Seconds / days since year 0** | Proleptic Gregorian or stated calendar; document epoch. |

Implementation: **pure client-side** math + tests with known vectors; group these as **sub-routes** (`/epoch-converter/ldap`, …) or **accordion/tabs** under “More formats”.

---

## **Section 10: Year 2038 & Education**

- **Countdown** to `2038-01-19` 32-bit signed **seconds** overflow (and short explanation).
- Optional: static reference table (1 hour / 1 day / … in seconds) like the reference site’s cheat sheet.

---

## **Section 11: Related Date Tools (Phase 2 — Optional)**

If you want closer parity with the reference site’s extra pages:

- Week number, day-of-year, **difference between two dates**, leap year checker, lunar phases — **separate routes** or deferred scope.

---

# ⚙️ Technical Optimization

## Frontend

- Use:
  - Vanilla JS or lightweight framework (no heavy UI libs needed)
- Use:
  - `Intl.DateTimeFormat` for timezone conversion
- Avoid:
  - Manual timezone calculations

---

## Backend (if needed)

- UUID generation:
  - `github.com/google/uuid`
- Avoid backend calls for:
  - Time conversion (do it client-side)

---

## Performance Considerations

- No API calls required → fully client-side for standard conversions
- Debounce input validation; **batch** tools stream or chunk very large inputs
- Lazy load **IANA timezone list** and **lazy-load** specialized format modules (Section 9) to keep initial bundle small

---

## UX Improvements

- Copy-to-clipboard everywhere
- Clear validation errors
- Default sensible values:
  - UUID tab opens first
  - UTC pre-selected
- **Epoch hub:** preferences (Section 4), per-tool **Clear**, optional **keyboard shortcut** to clear all
- Dark/light/device theme (align with reference)
- In-app **formula / epoch reference** for each specialized format (Section 9)

---

## Final Structure

```
/uuid
  ├── Generate UUID
  └── UUID Converter

/epoch-converter                    # hub — parity with epochconverter.com
  ├── Current time + epoch clock (live s/ms, copy)
  ├── Timezone converter (IANA)
  ├── Core: timestamp ↔ human (s / ms / µs / ns + flexible date parsing)
  ├── Preferences (locale, 12/24h, TZ default, date order, theme)
  ├── Period boundaries (start/end year | month | day)
  ├── Seconds → duration breakdown (y/mo/d/h/m)
  ├── Batch converter
  ├── Timestamp list (by month/year/range)
  ├── Year 2038 + cheat-sheet table (optional)
  └── More formats (tabs or sub-routes)
        ├── Unix hex, Bin/Oct/Hex epoch
        ├── LDAP / FILETIME, .NET ticks, GPS, Julian
        ├── WebKit/Chrome, Cocoa, HFS+, NTP, FAT, SAS, Excel OADate
        └── Seconds/days since year 0 (document calendar)

/epoch-converter/...               # optional deep links per specialized tool
```

---

