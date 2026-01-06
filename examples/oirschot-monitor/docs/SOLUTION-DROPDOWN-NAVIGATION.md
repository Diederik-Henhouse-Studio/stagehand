# ✅ DROPDOWN NAVIGATIE - WERKENDE OPLOSSING

**Datum:** 6 januari 2026
**Status:** ✅ WORKING
**Methode:** Playwright `locator().selectOption()`

---

## 🎯 HET PROBLEEM

De IBABS calendar gebruikt JavaScript dropdowns die een AJAX call maken naar:
```
https://oirschot.bestuurlijkeinformatie.nl/Calendar/GetMonthAgendas?month=11&year=2025
```

**Fouten methodes:**
- ❌ URL parameters (worden genegeerd)
- ❌ `page.selectOption()` (bestaat niet in Stagehand)
- ❌ `page.evaluate()` met `fetch()` (krijgt error page door sessie validatie)
- ❌ DOM manipulation met events (triggert geen AJAX)

---

## ✅ DE OPLOSSING

**Gebruik Playwright's `locator().selectOption()`** om de dropdowns ECHT te bedienen zoals een gebruiker:

```typescript
async navigateToMonth(year: number, month: number): Promise<void> {
  const page = this.stagehand.context.pages()[0];

  // Month is 0-indexed: 0=januari, 11=december
  const monthIndex = month - 1;

  // Select year
  await page.locator('#CurrentYear').selectOption(year.toString());
  await page.waitForTimeout(500);

  // Select month
  await page.locator('#CurrentMonth').selectOption(monthIndex.toString());

  // Wait for AJAX to complete
  await page.waitForTimeout(3000);

  // Verify
  const verification = await page.evaluate(() => {
    const yearSelect = document.querySelector('#CurrentYear') as HTMLSelectElement;
    const monthSelect = document.querySelector('#CurrentMonth') as HTMLSelectElement;
    return {
      year: yearSelect?.value,
      month: monthSelect?.value,
      monthText: monthSelect?.options[monthSelect.selectedIndex]?.text
    };
  });

  console.log(`Verified: ${verification.monthText} ${verification.year}`);
}
```

---

## 📊 RESULTATEN

### Voor (URL parameters):
```
URL: /Calendar?year=2025&month=11
Resultaat: 5 meetings uit januari 2026 ❌
```

### Na (Dropdown selectie):
```
Dropdowns: year=2025, month=11
Resultaat: 3 meetings uit december 2025 ✅

1. Besluitvormende raadsvergadering - 2 december 2025
2. Raadsbijeenkomst Openbaar - 8 december 2025
3. Besluitvormende raadsvergadering - 9 december 2025
```

---

## 🔑 KEY INSIGHTS

### 1. **Maand Index is 0-Based**
```typescript
const monthIndex = month - 1;
// Januari = 0
// December = 11
```

### 2. **Playwright Locator Pattern**
```typescript
// ✅ CORRECT (Playwright Page object)
await page.locator('#CurrentYear').selectOption('2025');

// ❌ FOUT (Stagehand wrapper heeft deze niet)
await page.selectOption('#CurrentYear', '2025');
```

### 3. **Timing is Cruciaal**
```typescript
// Wacht tussen dropdowns
await page.waitForTimeout(500);

// Wacht op AJAX completion
await page.waitForTimeout(3000);
```

### 4. **Verificatie is Essentieel**
```typescript
const verification = await page.evaluate(() => {
  const monthSelect = document.querySelector('#CurrentMonth') as HTMLSelectElement;
  return monthSelect?.options[monthSelect.selectedIndex]?.text;
});
// Returns: "december"
```

---

## 🏗️ WAAROM DIT WERKT

1. **Real Browser Events**
   - `locator().selectOption()` triggert alle native browser events
   - JavaScript event listeners worden correct gefired
   - AJAX call wordt automatisch gedaan

2. **Session Context Preserved**
   - Cookies blijven intact
   - CSRF tokens werken
   - Sessie blijft geldig

3. **Natural User Flow**
   - Browser denkt dat een echte gebruiker het doet
   - Geen anti-bot detectie issues
   - Volledige JavaScript execution

---

## 🚀 PERFORMANCE

**Timing breakdown:**
```
Navigation to Calendar page:    ~3s
Year dropdown selection:        ~0.5s
Month dropdown selection:       ~0.5s
AJAX request + response:        ~2-3s
Total navigation time:          ~6-7s
```

**vs. Failed API approach:**
```
Fetch API call:                 ~1s
Parse error page:               ~0.1s
Fallback to page reload:        ~3s
Still wrong data:               ❌
Total wasted time:              ~4s (with wrong result)
```

---

## 📝 IMPLEMENTATION CHECKLIST

- [x] Navigate to Calendar page first
- [x] Wait for page to load completely
- [x] Use `page.locator()` not `page.selectOption()`
- [x] Convert month to 0-indexed value
- [x] Select year first, then month
- [x] Wait between selections (500ms)
- [x] Wait for AJAX completion (3000ms)
- [x] Verify selection before extracting
- [x] Extract meetings from updated DOM

---

## 🎓 LESSONS LEARNED

### 1. **"Native is Better Than Clever"**
Don't try to outsmart the website with API calls. Just use the UI like a user would.

### 2. **"Stagehand ≠ Pure Playwright"**
Stagehand's `page` object is a wrapper. Some Playwright methods aren't available. Use `page.locator()` instead.

### 3. **"Session State Matters"**
API calls fail without proper session. Dropdown interaction preserves session automatically.

### 4. **"Timing Beats Waiting"**
Fixed waits (3000ms) work better than `waitForLoadState` for AJAX calls that don't trigger navigation events.

### 5. **"Verify Everything"**
Always verify dropdown selection before extraction. Dropdowns can silently fail.

---

## 🔮 FUTURE IMPROVEMENTS

### 1. **Network Wait Instead of Fixed Timeout**
```typescript
// Instead of:
await page.waitForTimeout(3000);

// Could use:
await page.waitForResponse(
  response => response.url().includes('/GetMonthAgendas')
);
```

### 2. **Retry Logic**
```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  await page.locator('#CurrentMonth').selectOption(monthIndex.toString());
  await page.waitForTimeout(2000);

  const meetings = await extractMeetings();
  if (meetings.length > 0) break;
}
```

### 3. **Month Name Validation**
```typescript
const expectedMonth = getMonthName(month);
const selectedMonth = await getSelectedMonthText();

if (selectedMonth !== expectedMonth) {
  throw new Error(`Month mismatch: expected ${expectedMonth}, got ${selectedMonth}`);
}
```

---

## 📚 REFERENCES

**Calendar Explorer:** `calendar-explorer.ts:242-285`
**IBABS Calendar URL:** https://oirschot.bestuurlijkeinformatie.nl/Calendar
**API Endpoint:** `/Calendar/GetMonthAgendas?month={0-11}&year={YYYY}`

**Playwright Docs:**
- [Locators](https://playwright.dev/docs/locators)
- [Select Options](https://playwright.dev/docs/input#select-options)

**Stagehand Docs:**
- [GitHub](https://github.com/browserbase/stagehand)

---

**Conclusie:** De simpelste oplossing (dropdown bedienen) is ook de beste. Sometimes you just need to click the buttons. 🖱️✨
