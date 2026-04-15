Here is the **complete color system** for your CLI — covering **all elements across upload, deploy, test, probe, debug**.

This is **not just styling** — it’s part of the product semantics.

---

# 🎨 CORE COLOR SYSTEM (GLOBAL)

| Meaning   | Symbol | Color          | Usage                 |
| --------- | ------ | -------------- | --------------------- |
| Success   | ✔      | **Green**      | working, valid, ready |
| Warning   | ⚠      | **Yellow**     | partial, degraded     |
| Failure   | ✖      | **Red**        | broken, blocking      |
| Skipped   | ⏭      | **Gray**       | not executed          |
| Info      | ℹ      | **Cyan**       | neutral info          |
| Section   | —      | **Bold White** | headers               |
| Metadata  | text   | **Gray**       | ids, URLs, hints      |
| Highlight | text   | **Bold**       | emphasis              |

---

# 🧩 1. HEADER BLOCK

```text
Datasource: hubspot.deals (hubspot)
Run: e2e
Status: ✖ FAIL
```

| Element                  | Color                |
| ------------------------ | -------------------- |
| Labels (Datasource, Run) | Gray                 |
| Values (hubspot.deals)   | Bold White           |
| Status symbol            | Green / Yellow / Red |
| Status text              | Same as symbol       |

---

# 🧠 2. VERDICT

```text
Verdict: ⚠ Limited production use
```

| State      | Color  |
| ---------- | ------ |
| Ready      | Green  |
| Limited    | Yellow |
| Not usable | Red    |

---

# 📊 3. DATA QUALITY BLOCK

```text
Data Quality:
✔ Schema coverage
⚠ Data consistency
✖ Data reliability
```

| Element       | Color      |
| ------------- | ---------- |
| Section title | Bold White |
| ✔             | Green      |
| ⚠             | Yellow     |
| ✖             | Red        |
| Text          | White      |

---

# 📈 4. CONFIDENCE

```text
Confidence: 89% (Good)
```

| Range  | Color  |
| ------ | ------ |
| 95–100 | Green  |
| 80–94  | Green  |
| 60–79  | Yellow |
| 40–59  | Yellow |
| <40    | Red    |

| Element    | Color         |
| ---------- | ------------- |
| Label      | Gray          |
| Value      | Bold White    |
| Level text | Same as range |

---

# 🔌 5. DATASOURCES LIST

```text
✔ contacts      (Ready)
⚠ deals         (Partial)
✖ engagements   (Failed)
```

| Element         | Color                                      |
| --------------- | ------------------------------------------ |
| Symbol          | Status color                               |
| Datasource name | White                                      |
| Status text     | Gray                                       |
| Failed row      | Entire line slightly red-tinted (optional) |

---

# ⚙️ 6. CAPABILITIES

```text
✔ deal.list
✖ deal.create (🔒 permission missing)
```

| Element         | Color  |
| --------------- | ------ |
| ✔               | Green  |
| ✖               | Red    |
| Capability name | White  |
| Permission hint | Gray   |
| 🔒 icon         | Yellow |

---

# ❗ 7. FAILURES / ISSUES

```text
✖ Missing field mapping: amount
  Hint: Fix mapping
```

| Element    | Color  |
| ---------- | ------ |
| ✖          | Red    |
| Error text | Red    |
| Hint label | Gray   |
| Hint text  | Yellow |

---

# 💥 8. IMPACT BLOCK

```text
Impact:
- deal.create will fail
```

| Element | Color      |
| ------- | ---------- |
| Title   | Bold White |
| Bullet  | Red        |
| Text    | White      |

---

# 🏗 9. INTEGRATION STEPS

```text
✔ fetch
✔ transform
✖ normalize
```

| Element   | Color |
| --------- | ----- |
| ✔         | Green |
| ✖         | Red   |
| Step name | White |
| Duration  | Gray  |

---

# 🏆 10. CERTIFICATION

```text
Certification:
Target: silver
Status: ✖ Not achieved
```

| Element       | Color      |
| ------------- | ---------- |
| Section title | Bold White |
| Target level  | White      |
| Achieved      | Green      |
| Not achieved  | Red        |
| Blockers      | Red        |

---

# 🧱 11. MATURITY LEVEL

```text
✔ Bronze
✖ Silver
✖ Gold
```

| Level        | Color |
| ------------ | ----- |
| Achieved     | Green |
| Not achieved | Red   |

---

# 🔐 12. IDENTITY BLOCK

```text
Identity:
Mode: system
Attribution: disabled
```

| Element        | Color      |
| -------------- | ---------- |
| Title          | Bold White |
| Labels         | Gray       |
| Values         | White      |
| Disabled flags | Yellow     |

---

# 🔑 13. CREDENTIAL (INTENT)

```text
Test endpoint:
GET https://...
⚠ Connectivity not tested
```

| Element      | Color  |
| ------------ | ------ |
| URL          | Cyan   |
| Method (GET) | Bold   |
| Warning      | Yellow |

---

# 🌐 14. DOCS / LINKS

```text
Docs:
http://localhost:3111/api/v1/rest/hubspot/docs
```

| Element | Color |
| ------- | ----- |
| Label   | Gray  |
| URL     | Cyan  |

---

# ⏳ 15. PROGRESS / ASYNC

```text
⏳ Running test...
```

| Element | Color  |
| ------- | ------ |
| ⏳       | Yellow |
| Text    | White  |

---

# 🔍 16. DEBUG

```text
Trace ID: trace_123
```

| Element | Color |
| ------- | ----- |
| Label   | Gray  |
| Value   | Cyan  |

---

# ⚠ 17. WARNINGS (NON-BLOCKING)

```text
⚠ Missing optional field mapping
```

| Element | Color  |
| ------- | ------ |
| ⚠       | Yellow |
| Text    | Yellow |

---

# ❌ 18. ERRORS (BLOCKING)

```text
✖ Permission denied
```

| Element | Color |
| ------- | ----- |
| ✖       | Red   |
| Text    | Red   |

---

# 🧭 19. NEXT ACTIONS

```text
Next actions:
- Fix mapping
```

| Element | Color      |
| ------- | ---------- |
| Title   | Bold White |
| Bullet  | Cyan       |
| Text    | White      |

---

# 🧪 20. PROBE RESULTS

```text
Credential Test:
✖ Failed (401)
```

| Element    | Color      |
| ---------- | ---------- |
| Section    | Bold White |
| Success    | Green      |
| Failure    | Red        |
| Code (401) | Gray       |

---

# 🧾 21. METADATA

```text
Upload ID: up_123
```

| Element | Color |
| ------- | ----- |
| Label   | Gray  |
| Value   | White |

---

# 🚨 CRITICAL RULES

### 1. Never use color without meaning

* No decorative colors
* Every color = semantic signal

---

### 2. Red = blocking only

* Never use red for warnings

---

### 3. Yellow = actionable but non-blocking

---

### 4. Green = safe / ready

---

### 5. Gray = secondary / metadata

---

### 6. Cyan = navigation (URLs, IDs, traces)

---

# 🧠 FINAL INSIGHT

This color system ensures:

👉 Developer scans screen in **< 2 seconds**
👉 Sees immediately:

* what is broken (red)
* what is risky (yellow)
* what is safe (green)