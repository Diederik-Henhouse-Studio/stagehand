# 🎯 Project Doelstelling: Nederlandse Gemeenten Transparantie Platform

## 📋 Kern Missie

**Maak alle gemeentelijke besluitvorming in Nederland doorzoekbaar en toegankelijk door automatische monitoring van overheidsportalen.**

---

## 🏛️ Context: Openbaarheid van Bestuur in Nederland

### Wettelijk Kader
- **Wet openbaarheid van bestuur (Wob)**: Gemeenten zijn verplicht besluitvorming openbaar te maken
- **80% van Nederlandse gemeenten** gebruikt één van twee systemen:
  - **IBABS** (Oirschot, +150 gemeenten)
  - **NOTUBIZ** (+200 gemeenten)

### Huidige Situatie
✅ Data is openbaar beschikbaar
❌ Niet centraal doorzoekbaar
❌ Geen historische vergelijking
❌ Geen automatische monitoring
❌ Niet machine-readable

---

## 🎯 Project Doelen

### Fase 1: Single System Mastery (IBABS) ✅ IN PROGRESS
**Doel:** Volledig in kaart brengen van IBABS systeem architectuur

#### 1.1 Pagina-Type Mapping
Voor elk IBABS pagina-type documenteren:
- **URL patroon** (bijv. `/Calendar`, `/Agenda/Index/{id}`)
- **HTML structuur** (selectors, DOM layout)
- **Beschikbare functies** (filters, navigatie, zoeken)
- **Data velden** (metadata, content, bijlagen)

**Output:** Page profiles per type

#### 1.2 Functie Inventarisatie
Per pagina-type:
- ✅ **Welke acties** kunnen uitgevoerd worden?
  - Jaar/maand selectie
  - Filteren op type vergadering
  - Zoeken in documenten
  - Paginering
- ✅ **Hoe worden ze bediend?**
  - Dropdown menus
  - Buttons
  - Query parameters
  - Form submissions

**Output:** Function registry per page-type

#### 1.3 Data Extractie Strategie
- **Baseline extractie**: Alle vergaderingen + metadata
- **Deep extractie**: Agendapunten + beschrijvingen
- **Document extractie**: Bijlagen (PDF, Word, etc.)
- **Relaties**: Links tussen documenten

**Output:** Extraction profiles

---

### Fase 2: Multi-System Support (IBABS + NOTUBIZ)
**Doel:** Uitbreiden naar NOTUBIZ systeem

#### 2.1 NOTUBIZ Systeem Analyse
- Vergelijk met IBABS architectuur
- Identificeer overeenkomsten en verschillen
- Maak aparte page profiles waar nodig
- Hergebruik extractie logica waar mogelijk

#### 2.2 System Detection
Automatisch detecteren welk systeem een gemeente gebruikt:
```typescript
interface MunicipalityProfile {
  name: string;
  system: 'IBABS' | 'NOTUBIZ';
  baseUrl: string;
  specialFeatures?: string[];
}
```

---

### Fase 3: Gemeente Registry
**Doel:** Database van alle Nederlandse gemeenten

#### 3.1 Gemeente Catalogus
Voor elke gemeente registreren:
- ✅ Naam
- ✅ Welk systeem (IBABS/NOTUBIZ)
- ✅ Base URL
- ✅ Special config (indien afwijkend)
- ✅ Update frequentie
- ✅ Contactgegevens

**Output:** `municipalities.json`
```json
[
  {
    "id": "oirschot",
    "name": "Gemeente Oirschot",
    "system": "IBABS",
    "baseUrl": "https://oirschot.bestuurlijkeinformatie.nl",
    "region": "Noord-Brabant",
    "population": 18500
  }
]
```

#### 3.2 Bulk Monitoring
- Dagelijkse scan van alle geregistreerde gemeenten
- Parallel processing (10-20 gemeenten tegelijk)
- Change detection per gemeente
- Centrale database voor alle data

---

### Fase 4: Platform & API
**Doel:** Maak data toegankelijk voor burgers, journalisten, onderzoekers

#### 4.1 REST API
```
GET /api/municipalities
GET /api/municipalities/{id}/meetings
GET /api/municipalities/{id}/meetings/{meetingId}
GET /api/search?q=duurzaamheid&municipality=oirschot
```

#### 4.2 Web Dashboard
- Overzicht alle gemeenten
- Zoeken over alle vergaderingen
- Trend analyse
- Comparison tool

#### 4.3 Notificaties
- Email alerts bij nieuwe besluiten
- RSS feeds per gemeente
- Webhook integraties

---

## 🏗️ Technische Architectuur

### System Registry
```
systems/
├── ibabs/
│   ├── page-profiles.ts       # Alle IBABS pagina types
│   ├── functions.ts            # Beschikbare functies
│   ├── extractors.ts           # Data extractie
│   └── README.md               # IBABS documentatie
├── notubiz/
│   ├── page-profiles.ts
│   ├── functions.ts
│   ├── extractors.ts
│   └── README.md
└── registry.ts                 # System detection
```

### Municipality Registry
```
municipalities/
├── registry.json               # Alle gemeenten
├── profiles/
│   ├── oirschot.json
│   ├── eindhoven.json
│   └── ...
└── validator.ts                # Config validatie
```

### Core Engine
```
core/
├── scraper.ts                  # Generic scraper
├── scheduler.ts                # Bulk processing
├── change-detector.ts          # Diff algorithm
└── storage.ts                  # Database layer
```

---

## 📊 Huidige Status

### ✅ Wat Werkt (Oirschot/IBABS)
- [x] Calendar pagina scraping
- [x] Meeting list extractie
- [x] Deep meeting details (agendapunten)
- [x] Traditional scraping (100% accuracy)
- [x] Session tracking
- [x] JSON output

### 🔄 In Progress
- [ ] **Calendar functie detectie** ← NU
- [ ] **Jaar/maand selectie automation** ← NU
- [ ] **Complete IBABS page-type mapping**
- [ ] **Function registry**

### 📋 TODO
- [ ] NOTUBIZ systeem analyse
- [ ] Gemeente registry
- [ ] Change detection
- [ ] Database setup
- [ ] API development
- [ ] Dashboard

---

## 🎯 Immediate Next Steps (Deze Sessie)

### 1. Calendar Functie Exploratie ⚡
**Doel:** Begrijp alle beschikbare functies op Calendar pagina

**Test Plan:**
```typescript
✓ Bezoek https://oirschot.bestuurlijkeinformatie.nl/Calendar
✓ Detecteer jaar selectie mechanisme
✓ Detecteer maand selectie mechanisme
✓ Test: Zet op december 2025
✓ Verifieer: Zijn meetings correct gefilterd?
✓ Documenteer: Welke HTML elementen/events?
```

**Output:**
- `calendar-functions.md` - Alle functies gedocumenteerd
- `calendar-automation.ts` - Werkende implementatie

### 2. December 2025 Data Extractie ⚡
```typescript
✓ Haal alle vergaderingen op uit december 2025
✓ Open elke vergadering individueel
✓ Map alle content types:
  - Titel, datum, tijd, locatie
  - Agendapunten (genummerd)
  - Beschrijvingen
  - Bijlagen (per type)
  - Metadata (voorzitter, etc.)
  - Video/audio links (indien aanwezig)
```

### 3. Page-Type Profile Creatie ⚡
Voor elk pagina type maken we:
```typescript
interface PageTypeProfile {
  name: string;              // "Calendar", "MeetingDetail"
  urlPattern: RegExp;        // URL matching

  // HTML Structure
  selectors: {
    [key: string]: string | string[];
  };

  // Available Functions
  functions: {
    name: string;            // "selectMonth"
    trigger: string;         // "click button[data-month]"
    parameters: string[];    // ["month: number"]
  }[];

  // Data Extractors
  extractors: {
    [key: string]: (element: Element) => any;
  };
}
```

---

## 📈 Success Metrics

### Phase 1 Complete When:
- ✅ Alle IBABS pagina types gemapped
- ✅ Alle functies geïnventariseerd
- ✅ 95%+ extractie accuracy
- ✅ Automated testing suite

### Phase 2 Complete When:
- ✅ NOTUBIZ ook volledig gemapped
- ✅ System detection werkt
- ✅ Getest op 5+ gemeenten per systeem

### Phase 3 Complete When:
- ✅ 100+ gemeenten geregistreerd
- ✅ Daily monitoring operational
- ✅ Change detection werkt
- ✅ Database contains 30+ dagen data

### Phase 4 Complete When:
- ✅ API publiekelijk beschikbaar
- ✅ Dashboard live
- ✅ 1000+ meetings doorzoekbaar
- ✅ Real-time notifications

---

## 🌟 Impact

### Voor Burgers
- 🔍 **Doorzoekbaarheid**: Vind relevante besluiten
- 📊 **Transparantie**: Zie wat je gemeente doet
- 🔔 **Alerts**: Blijf op de hoogte

### Voor Journalisten
- 📰 **Research tool**: Snelle fact-checking
- 📈 **Trends**: Vergelijk gemeenten
- 🎯 **Story discovery**: Vind interessante cases

### Voor Onderzoekers
- 📚 **Dataset**: Machine-readable data
- 🧪 **Analyse**: Kwantitatief onderzoek
- 🔗 **API access**: Integratie in tools

### Voor Gemeenten
- ✅ **Compliance**: Voldoe aan Wob eisen
- 📊 **Benchmark**: Vergelijk met anderen
- 💡 **Best practices**: Leer van anderen

---

## 📞 Contact & Contributie

Dit is een **open source** project.

**Contribute:**
- Voeg gemeenten toe aan registry
- Verbeter extractie profiles
- Test op nieuwe gemeenten
- Rapporteer bugs

**Roadmap:** Zie `VOLGENDE-STAPPEN.md`
**Tech Docs:** Zie `docs/`
**API Docs:** Zie `api-documentation.md` (coming soon)

---

**Versie:** 0.1.0 (MVP Phase)
**Laatste Update:** 2026-01-06
**Status:** 🚧 Active Development
