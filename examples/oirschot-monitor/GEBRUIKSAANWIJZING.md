# Gebruiksaanwijzing - Oirschot Monitor MVP

## 📌 Wat Doet Deze MVP?

Deze MVP analyseert de website **oirschot.bestuurlijkeinformatie.nl** en extraheert:

1. **Beschikbare secties** - Alle hoofdmenu items (Dashboard, Vergaderingen, Overzichten, Wie is wie)
2. **Recente items** - Nieuwe moties, ingekomen stukken, en toezeggingen met datum
3. **Aankomende vergaderingen** - Kalender met vergaderingen inclusief datum/tijd/locatie
4. **Monitoring aanbevelingen** - Strategieën voor het detecteren van wijzigingen

## 🎯 Gedetecteerde Content

Op basis van de analyse hebben we het volgende gevonden:

### Hoofdsecties
- **Dashboard**: Overzicht van recente activiteiten
- **Vergaderingen**: Kalender met alle gemeenteraadsvergaderingen
- **Overzichten**: Besluiten, moties, raadsvragen, verordeningen, controleverslagen
- **Wie is wie**: Raadsleden en bestuurders directory

### Recent Items Table
De homepage toont een tabel met de 10 meest recente items:
- **Categorieën**: Ingekomen stukken, Moties, Toezeggingen
- **Informatie**: Titel, categorie, wijzigingsdatum
- **Datums**: Range van december 2025 tot vandaag

### Vergaderingen
- Kalender van november 2025 tot februari 2026
- Details per vergadering: datum, tijd, locatie
- Verschillende commissies en raadsvergaderingen

## 🚀 MVP Uitvoeren

### Vereisten

1. **Node.js 18+** geïnstalleerd
2. **Chrome browser** geïnstalleerd (voor LOCAL mode)
3. **Geen API keys** nodig (gebruikt lokale browser)

### Stap 1: Dependencies Installeren

```bash
cd examples/oirschot-monitor
npm install
```

### Stap 2: Script Uitvoeren

```bash
# Met tsx (aanbevolen voor development)
npm run analyze

# Of via build + uitvoeren
npm run build
npm start
```

### Stap 3: Output Bekijken

Het script zal de volgende stappen doorlopen:

```
🚀 Starting Oirschot Portal Analysis...
📡 Navigating to website...
✅ Page loaded successfully

📋 Step 1: Analyzing available sections...
📄 Step 2: Extracting recent items...
📅 Step 3: Looking for upcoming meetings...
💡 Monitoring Recommendations...

✅ Analysis complete!
📊 Summary: [statistics]
```

## 📊 Verwachte Resultaten

### Console Output
Je krijgt een gestructureerd overzicht met:
- Aantal geanalyseerde secties
- Lijst van recente items met categorieën
- Aankomende vergaderingen met details
- Concrete aanbevelingen voor monitoring

### Data Structuur
De geëxtraheerde data volgt deze TypeScript schemas:

```typescript
// Recent items
{
  items: [
    {
      title: string,
      category: string,
      date: string,
      url?: string
    }
  ]
}

// Meetings
{
  meetings: [
    {
      title: string,
      date: string,
      time?: string,
      location?: string
    }
  ]
}

// Sections
{
  sections: [
    {
      name: string,
      description: string
    }
  ]
}
```

## 🔍 Monitoring Strategieën

Gebaseerd op de analyse, zijn dit de aanbevolen strategieën:

### 1. **Recent Items Monitoring**
- **Wat**: Monitor de "recente items" tabel op de homepage
- **Hoe**: Vergelijk de lijst bij elke run met een baseline
- **Waarom**: Nieuwe moties, stukken en toezeggingen verschijnen hier eerst
- **Frequentie**: Dagelijks

### 2. **Vergadering Tracking**
- **Wat**: Houd de vergaderkalender in de gaten
- **Hoe**: Check voor nieuwe vergaderingen of wijzigingen in bestaande
- **Waarom**: Belangrijke besluitvorming gebeurt in vergaderingen
- **Frequentie**: Wekelijks

### 3. **Datum-gebaseerde Change Detection**
- **Wat**: Track de "datum wijziging" velden
- **Hoe**: Sorteer op datum en markeer nieuwe/gewijzigde items
- **Waarom**: Directe indicator van updates
- **Frequentie**: Bij elke run

### 4. **Sectie-specifieke Monitoring**
- **Wat**: Monitor specifieke overzichten (besluiten, moties, etc.)
- **Hoe**: Navigeer naar subpagina's en extracteer lijsten
- **Waarom**: Meer gedetailleerde informatie dan homepage
- **Frequentie**: Wekelijks of per behoefte

### 5. **Baseline Snapshot**
- **Wat**: Sla eerste analyse op als referentiepunt
- **Hoe**: Bewaar output in database of JSON file
- **Waarom**: Maakt vergelijking en change detection mogelijk
- **Frequentie**: Eenmalig + updates

## 🔄 Volgende Stappen

### Fase 2: Change Detection
1. **Database Setup**: PostgreSQL of SQLite voor baseline opslag
2. **Diff Algorithm**: Vergelijk nieuwe data met baseline
3. **Notification System**: Email/Slack bij wijzigingen
4. **Scheduling**: Cron job voor automatische runs

### Fase 3: Deep Analysis
1. **Document Scraping**: Download en analyseer PDFs
2. **Link Following**: Klik door naar detail pagina's
3. **Content Extraction**: Haal tekst uit vergaderstukken
4. **Categorization**: Automatische classificatie van items

### Fase 4: Integration
1. **API Development**: REST API voor externe systemen
2. **Webhook Support**: Push updates naar externe systemen
3. **Export Formats**: JSON, CSV, XML output
4. **Dashboard**: Web interface voor monitoring

## 🛠️ Technische Aanpassingen

### Custom Extraction
Je kunt de schemas aanpassen voor specifieke data:

```typescript
// In mvp-analyzer.ts, voeg toe:
const CustomSchema = z.object({
  // Jouw eigen velden hier
});

const result = await stagehand.extract({
  instruction: "Extract custom data",
  schema: CustomSchema,
});
```

### Andere Pagina's
Navigeer naar subpagina's:

```typescript
// Na de hoofdpagina:
await stagehand.act({ action: "click", selector: "a[href='/meetings']" });
// Of direct:
await page.goto("https://oirschot.bestuurlijkeinformatie.nl/meetings");
```

### Error Handling
Voeg error recovery toe:

```typescript
try {
  const result = await stagehand.extract({ ... });
} catch (error) {
  console.error("Extraction failed:", error);
  // Fallback strategie
}
```

## ⚠️ Belangrijke Opmerkingen

1. **Rate Limiting**: Wees voorzichtig met te frequente requests
2. **Browser Resources**: LOCAL mode opent een echte Chrome instance
3. **Data Privacy**: Respecteer privacy van persoonlijke informatie
4. **Terms of Service**: Check website voorwaarden voor scraping
5. **Backup**: Bewaar data regelmatig

## 🐛 Troubleshooting

### "Chrome not found"
```bash
# Installeer Chrome:
# Ubuntu/Debian:
sudo apt-get install google-chrome-stable

# macOS:
brew install --cask google-chrome
```

### "Module not found"
```bash
# Herinstalleer dependencies:
cd examples/oirschot-monitor
rm -rf node_modules package-lock.json
npm install
```

### "Timeout during extraction"
```typescript
// Verhoog timeout in extract call:
await stagehand.extract({
  instruction: "...",
  schema: Schema,
  timeout: 30000, // 30 seconden
});
```

### "Verbose logging"
```typescript
// Enable verbose mode:
const stagehand = new Stagehand({
  env: 'LOCAL',
  verbose: 2, // Maximum logging
});
```

## 📞 Support

Voor vragen of problemen:
1. Check de [Stagehand documentatie](https://docs.stagehand.dev)
2. Open een issue in de Stagehand repository
3. Review de code comments in `mvp-analyzer.ts`

## 📄 Licentie

MIT - Vrij te gebruiken en aan te passen voor jouw doeleinden.
