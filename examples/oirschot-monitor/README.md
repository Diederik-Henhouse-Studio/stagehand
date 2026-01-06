# Oirschot Bestuurlijke Informatie Monitor - MVP

Een Minimum Viable Product (MVP) voor het monitoren van wijzigingen op de website van de gemeente Oirschot's bestuurlijke informatieportaal.

## 🎯 Doel

Deze MVP analyseert de website [oirschot.bestuurlijkeinformatie.nl](https://oirschot.bestuurlijkeinformatie.nl/) om:
1. Te bepalen welke informatie beschikbaar is
2. Te begrijpen hoe de data gestructureerd is
3. Aanbevelingen te geven voor monitoring strategieën

## 📋 Wat Analyseert de MVP?

Het script extraheert en analyseert:
- **Beschikbare secties**: Alle hoofdnavigatie items en hun functie
- **Recente items**: Nieuwe moties, ingekomen stukken, toezeggingen
- **Aankomende vergaderingen**: Geplande raadsvergaderingen met datum/tijd/locatie
- **Monitoring aanbevelingen**: Gebaseerd op de gevonden data

## 🚀 Gebruik

### Installatie

```bash
cd examples/oirschot-monitor
npm install
```

### Script Uitvoeren

```bash
# Met tsx (development)
npm run analyze

# Of via TypeScript compilatie
npm run build
npm start
```

### Vereisten

- Node.js 18+
- Chrome/Chromium browser geïnstalleerd (voor Stagehand LOCAL mode)
- Geen API keys nodig (gebruikt lokale browser)

## 📊 Output Voorbeeld

Het script geeft de volgende informatie:

```
🚀 Starting Oirschot Portal Analysis...

📡 Navigating to https://oirschot.bestuurlijkeinformatie.nl/...
✅ Page loaded successfully

📋 Step 1: Analyzing available sections...
Found 4 main sections:
  - Dashboard: Overzicht van recente items en vergaderingen
  - Vergaderingen: Kalender met alle vergaderingen
  - Overzichten: Besluiten, moties, vragen, verordeningen
  - Wie is wie: Raadsleden en bestuurders

📄 Step 2: Extracting recent items from the dashboard...
Found 10 recent items:
  - [Moties] Motie inzake parkeerbeleid (12-01-2026)
  - [Ingekomen stukken] Brief over duurzaamheid (10-01-2026)
  ...

📅 Step 3: Looking for upcoming meetings...
Found 8 upcoming meetings:
  - Raadsvergadering on 15-01-2026 at 20:00
  ...

💡 Monitoring Recommendations:
  1. Monitor recent items table for new submissions
  2. Track upcoming meetings calendar
  3. Monitor specific sections: Vergaderingen, Overzichten
  4. Implement change detection by comparing dates
  5. Store baseline snapshot for comparison
```

## 🔧 Technische Details

### Gebruikte Technologieën

- **Stagehand V3**: Browser automation met AI-gestuurde extractie
- **Zod**: Schema validatie voor type-safe data extractie
- **TypeScript**: Type-veilige code
- **Playwright**: (via Stagehand) Browser automation

### Data Schemas

Het script definieert drie hoofdschema's:

1. **RecentItemSchema**: Voor recente documenten/moties
   ```typescript
   { title, category, date, url? }
   ```

2. **MeetingSchema**: Voor vergaderingen
   ```typescript
   { title, date, time?, location? }
   ```

3. **AvailableSectionsSchema**: Voor navigatie secties
   ```typescript
   { name, description }
   ```

## 🔄 Volgende Stappen

Na deze MVP kun je overwegen:

1. **Periodieke Monitoring**
   - Cron job setup voor dagelijkse/wekelijkse checks
   - Baseline data opslaan in database

2. **Change Detection**
   - Diff algoritme implementeren
   - Notificaties bij nieuwe items

3. **Data Export**
   - Integratie met extern systeem
   - API endpoints voor data toegang

4. **Geavanceerde Features**
   - Deep-dive in specifieke documenten
   - PDF extractie van vergaderstukken
   - Sentiment analyse van moties

## 📝 Licentie

MIT

## 🤝 Contact

Voor vragen of suggesties, open een issue of PR.
