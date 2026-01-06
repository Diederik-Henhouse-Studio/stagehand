# Frequently Asked Questions

Common questions about Politeia.

---

## General

### What is Politeia?

Politeia is a Scraping-as-a-Service platform that extracts structured data from governmental portals, social media, and custom websites using a configuration-driven approach.

### Why use Politeia instead of building my own scraper?

**Benefits:**
- ✅ No browser infrastructure management
- ✅ Configuration-driven (add platforms without code)
- ✅ Built-in error handling and retries
- ✅ Horizontal scalability
- ✅ 90x cost reduction vs 24/7 browsers

---

## Technical

### Which platforms are supported?

**Current:**
- NOTUBIZ (100+ Dutch municipalities)
- IBIS (Major cities)

**Coming Soon:**
- YouTube
- X (Twitter)
- Facebook
- Instagram
- Custom websites

### Can I add my own platform?

Yes! See [Adding New Platforms](../04-platforms/adding-new-platforms.md).

### Does it work without JavaScript?

For most governmental portals (NOTUBIZ, IBIS), yes. Server-side rendered HTML is sufficient. For dynamic sites, Browserbase executes JavaScript.

---

## Integration

### How do I integrate Politeia?

1. **Direct HTTP:** Call REST API from your system
2. **Client Libraries:** Use pre-built clients (Node.js, Python)
3. **Webhooks:** Receive async callbacks

See [Quick Start](./quickstart.md).

### What language can I use?

Any! Politeia is language-agnostic. Use:
- Node.js/TypeScript
- Python
- Go
- Java
- PHP
- etc.

### Do you provide client libraries?

Yes:
- **Node.js:** `npm install @politeia/client`
- **Python:** `pip install politeia-client`

---

## Pricing & Costs

### How much does Politeia cost?

**Browserbase costs:**
- \$0.001 per session (typically 3-5s)
- \$8/month for 100 municipalities (daily scraping)
- 90x cheaper than 24/7 browser

**Politeia service:**
- Free for open source
- Self-hosted: Free
- Managed: Contact for pricing

### What about Browserbase limits?

**Free tier:**
- 100 sessions/month
- Good for 3-5 municipalities

**Paid:**
- Unlimited sessions
- Pay per use

---

## Operations

### How do I monitor scraping?

1. **Browserbase Dashboard:** View session recordings
2. **Logs:** Structured JSON logs
3. **Metrics:** Prometheus/Grafana
4. **Alerts:** Error notifications

### What if scraping fails?

Politeia includes:
- Automatic retries (3x default)
- Exponential backoff
- Fallback strategies
- Error categorization

### Can I scale horizontally?

Yes! Deploy multiple instances behind a load balancer. See [Scaling Guide](../09-operations/scaling.md).

---

## Data

### Where is data stored?

Politeia is **stateless**. Your external system stores data (e.g., Supabase, PostgreSQL).

### How is change detection done?

**Hash-based comparison:**
1. Scrape meeting list
2. Calculate SHA-256 hash
3. Compare with stored hash
4. Detect new/modified/removed meetings

External system handles this logic.

### Can I get historical data?

Politeia scrapes current data. For historical data:
1. Run daily scraping
2. Store results over time
3. Build historical dataset

---

## Security

### Is authentication required?

**Optional:**
- API key authentication
- JWT tokens
- OAuth 2.0 (custom)

### How are credentials managed?

- Browserbase API key in environment variables
- Never hardcoded
- Rotation supported

### Is data encrypted?

- HTTPS for all API calls
- TLS for Browserbase connections
- Encrypted at rest (Supabase)

---

## Troubleshooting

### "BROWSERBASE_API_KEY not found"

Set environment variable:
```bash
export BROWSERBASE_API_KEY=your_key
export BROWSERBASE_PROJECT_ID=your_project
```

### Scraping returns 0 meetings

**Possible causes:**
1. Wrong month/year parameters
2. Platform configuration mismatch
3. Website structure changed

**Solution:** Check Browserbase session recording.

### Request timeout

**Default timeout:** 60s

**Solutions:**
1. Increase timeout in config
2. Optimize selectors
3. Check website performance

### Selector not found

**Error:** `Could not find element for selector`

**Solutions:**
1. Verify selector in platform config
2. Check if website HTML changed
3. Use Browserbase debugger

---

## Development

### How do I test locally?

```bash
# 1. Clone repository
git clone https://github.com/your-org/politeia.git

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.example .env

# 4. Start service
npm run dev

# 5. Test API
curl http://localhost:3000/health
```

### Can I use mock data?

Yes! Set `MOCK_MODE=true` to use test data instead of real scraping.

### How do I debug sessions?

Use Browserbase live debugging:
```typescript
const debugUrl = context._debugUrl;
console.log('Debug:', debugUrl);
// Open URL in browser
```

---

## Deployment

### How do I deploy Politeia?

**Options:**
1. **Docker:** `docker run politeia/service`
2. **Kubernetes:** See [K8s Guide](../07-deployment/kubernetes.md)
3. **Serverless:** AWS Lambda, Google Cloud Functions

### What are the system requirements?

**Minimum:**
- 512MB RAM
- 1 CPU core
- Node.js 18+

**Recommended:**
- 2GB RAM
- 2 CPU cores
- Auto-scaling

### How many municipalities can one instance handle?

**Single instance:**
- 10-20 municipalities (daily scraping)
- 5 concurrent sessions

**Multiple instances:**
- Unlimited with load balancing

---

## Advanced

### Can I customize extraction logic?

Yes! Platform configurations allow:
- Custom CSS selectors
- Extraction rules
- Transformation functions

### Can I scrape websites other than governmental portals?

Yes! Politeia supports:
- Social media (YouTube, X, Facebook)
- Generic websites
- Custom platforms

See [Extensions](../08-extensions/).

### Can I run without Browserbase?

Not recommended, but possible:
- Use Puppeteer/Playwright directly
- Manage browser infrastructure yourself
- Lose benefits of managed service

---

## Support

### Where can I get help?

- 📚 [Documentation](../README.md)
- 💬 [GitHub Issues](https://github.com/your-org/politeia/issues)
- 📧 Email: support@politeia.example.com

### How do I report bugs?

1. Check [Troubleshooting Guide](../09-operations/troubleshooting.md)
2. Open GitHub issue
3. Include:
   - Error message
   - Request/response
   - Browserbase session URL

### Can I contribute?

Yes! Contributions welcome:
- Add new platforms
- Improve documentation
- Fix bugs
- Add features

See [Contributing Guide](../CONTRIBUTING.md).

---

[← Back to Documentation Index](../README.md)
