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

### 🔹 Layout Sections

---

## **Section 1: Current Time Display**

**UI Elements:**

- Analog Clock (optional but good UX)
- Digital Clock:
  - 12-hour format (AM/PM)
  - 24-hour format
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

## **Section 3: Epoch Converter (Recommended Addition)**

*(This is missing in your requirement but expected for "epoch converter")*

**UI Elements:**

- Input:
  - Epoch timestamp (seconds / milliseconds)
- Toggle:
  - Seconds / Milliseconds
- Button: `Convert`
- Output:
  - Human-readable date (UTC + selected timezone)

**Reverse Conversion:**

- Input: Date/time picker
- Output: Epoch timestamp

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

- No API calls required → fully client-side
- Debounce input validation
- Lazy load timezone list (if large)

---

## UX Improvements

- Copy-to-clipboard everywhere
- Clear validation errors
- Default sensible values:
  - UUID tab opens first
  - UTC pre-selected
- Dark/light mode (optional)

---

## Final Structure

```
/uuid
  ├── Generate UUID
  └── UUID Converter

/epoch-converter
  ├── Current Time (UTC default)
  ├── Timezone Converter
  └── Epoch Converter
```

---

