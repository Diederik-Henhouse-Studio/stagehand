# Facebook Extension

Extend Politeia to monitor Facebook pages, public groups, and posts for political content and civic engagement.

---

## Overview

Facebook Graph API integration enables:
- ✅ Page post monitoring
- ✅ Public group scraping
- ✅ Comment extraction
- ✅ Engagement metrics tracking
- ✅ Event monitoring
- ✅ Video content analysis

**Use Cases:**
- Monitor political party pages
- Track government announcements
- Analyze public opinion in civic groups
- Monitor political events
- Archive political statements

---

## Facebook Graph API Setup

### Authentication

Facebook requires OAuth 2.0 for API access:

```typescript
// config/facebook-config.ts
export interface FacebookConfig {
  appId: string;
  appSecret: string;
  accessToken: string;
  apiUrl: string;
  version: string;
  rateLimits: {
    callsPerHour: number;
  };
}

const config: FacebookConfig = {
  appId: process.env.FACEBOOK_APP_ID!,
  appSecret: process.env.FACEBOOK_APP_SECRET!,
  accessToken: process.env.FACEBOOK_ACCESS_TOKEN!,
  apiUrl: 'https://graph.facebook.com',
  version: 'v18.0',
  rateLimits: {
    callsPerHour: 200  // Per page/user
  }
};
```

### Get API Access

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create new app: "Politeia Social Monitor"
3. Add Facebook Login product
4. Generate App ID and App Secret
5. Get User Access Token with required permissions:
   - `pages_read_engagement`
   - `pages_read_user_content`
   - `public_profile`

**Generate Long-Lived Token:**
```bash
curl "https://graph.facebook.com/v18.0/oauth/access_token?\
grant_type=fb_exchange_token&\
client_id={app-id}&\
client_secret={app-secret}&\
fb_exchange_token={short-lived-token}"
```

---

## Platform Configuration

```yaml
# config/platforms/facebook/v1.0.0.yaml
platform:
  type: FACEBOOK
  version: "1.0.0"
  vendor: Meta

baseUrl: "https://www.facebook.com"
apiUrl: "https://graph.facebook.com/v18.0"

features:
  - page-posts
  - page-info
  - post-comments
  - post-reactions
  - events
  - videos
  - live-videos

authentication:
  type: oauth2
  scopes:
    - pages_read_engagement
    - pages_read_user_content
  rateLimits:
    callsPerHour: 200

extraction:
  methods:
    - api  # Primary
    - scraping  # Fallback (requires login, limited)
```

---

## Request Types

### 1. Page Post Monitoring

```typescript
interface PagePostsRequest {
  requestType: 'facebook-page-posts';
  requestId: string;
  page: {
    id?: string;  // Numeric page ID
    username?: string;  // @username
  };
  parameters: {
    maxPosts?: number;
    since?: string;  // Unix timestamp or strtotime
    until?: string;
    includeComments?: boolean;
    includeReactions?: boolean;
  };
}
```

**Example:**
```json
{
  "requestType": "facebook-page-posts",
  "requestId": "uuid",
  "page": {
    "username": "VVD"
  },
  "parameters": {
    "maxPosts": 50,
    "since": "2025-10-01",
    "includeComments": true,
    "includeReactions": true
  }
}
```

### 2. Post Details

```typescript
interface PostDetailsRequest {
  requestType: 'facebook-post-details';
  requestId: string;
  postId: string;
  extractionOptions: {
    includeComments: boolean;
    maxComments?: number;
    includeReactions: boolean;
    includeShares: boolean;
  };
}
```

---

## API Implementation

### Page Posts

```typescript
// src/platforms/facebook/api.ts
import axios from 'axios';

export class FacebookAPI {
  private accessToken: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getPagePosts(
    pageId: string,
    maxPosts: number = 50,
    since?: string
  ): Promise<FacebookPost[]> {
    const posts: FacebookPost[] = [];
    let nextUrl: string | undefined = `${this.baseUrl}/${pageId}/posts`;

    do {
      const response = await axios.get(nextUrl, {
        params: {
          access_token: this.accessToken,
          fields: 'id,message,created_time,full_picture,permalink_url,shares,reactions.summary(true),comments.summary(true)',
          limit: Math.min(maxPosts - posts.length, 100),
          ...(since && { since })
        }
      });

      for (const post of response.data.data) {
        posts.push({
          id: post.id,
          message: post.message || '',
          createdTime: post.created_time,
          permalink: post.permalink_url,
          pictureUrl: post.full_picture,
          metrics: {
            reactions: post.reactions?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            shares: post.shares?.count || 0
          }
        });
      }

      nextUrl = response.data.paging?.next;
    } while (nextUrl && posts.length < maxPosts);

    return posts;
  }

  async getPostComments(
    postId: string,
    maxComments: number = 100
  ): Promise<FacebookComment[]> {
    const comments: FacebookComment[] = [];
    let nextUrl: string | undefined = `${this.baseUrl}/${postId}/comments`;

    do {
      const response = await axios.get(nextUrl, {
        params: {
          access_token: this.accessToken,
          fields: 'id,message,created_time,from,like_count,comment_count',
          limit: Math.min(maxComments - comments.length, 100),
          order: 'reverse_chronological'
        }
      });

      for (const comment of response.data.data) {
        comments.push({
          id: comment.id,
          message: comment.message,
          createdTime: comment.created_time,
          author: {
            id: comment.from.id,
            name: comment.from.name
          },
          likeCount: comment.like_count || 0,
          replyCount: comment.comment_count || 0
        });
      }

      nextUrl = response.data.paging?.next;
    } while (nextUrl && comments.length < maxComments);

    return comments;
  }

  async getPageInfo(pageId: string): Promise<FacebookPage> {
    const response = await axios.get(`${this.baseUrl}/${pageId}`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,name,username,about,category,fan_count,followers_count,link,picture'
      }
    });

    return {
      id: response.data.id,
      name: response.data.name,
      username: response.data.username,
      about: response.data.about,
      category: response.data.category,
      fanCount: response.data.fan_count,
      followersCount: response.data.followers_count,
      url: response.data.link,
      pictureUrl: response.data.picture?.data?.url
    };
  }

  async getPostReactions(postId: string): Promise<FacebookReactionBreakdown> {
    const response = await axios.get(`${this.baseUrl}/${postId}/reactions`, {
      params: {
        access_token: this.accessToken,
        summary: 'total_count'
      }
    });

    const breakdown: FacebookReactionBreakdown = {
      total: response.data.summary.total_count,
      like: 0,
      love: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0
    };

    // Get breakdown by type
    for (const type of ['LIKE', 'LOVE', 'HAHA', 'WOW', 'SAD', 'ANGRY']) {
      const typeResponse = await axios.get(`${this.baseUrl}/${postId}/reactions`, {
        params: {
          access_token: this.accessToken,
          type,
          summary: 'total_count',
          limit: 0
        }
      });

      breakdown[type.toLowerCase()] = typeResponse.data.summary.total_count;
    }

    return breakdown;
  }
}
```

### Batch Requests

Facebook supports batch requests to reduce API calls:

```typescript
async function batchRequests(requests: string[]): Promise<any[]> {
  const batch = requests.map((url, i) => ({
    method: 'GET',
    relative_url: url.replace('https://graph.facebook.com/v18.0/', ''),
    name: `request${i}`
  }));

  const response = await axios.post(
    `${this.baseUrl}/`,
    {
      access_token: this.accessToken,
      batch: JSON.stringify(batch)
    }
  );

  return response.data.map((item: any) => JSON.parse(item.body));
}

// Usage
const results = await batchRequests([
  '/page1/posts?fields=id,message',
  '/page2/posts?fields=id,message',
  '/page3/posts?fields=id,message'
]);
```

---

## Data Models

### Supabase Schema

```sql
-- Facebook pages
CREATE TABLE facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100),
  about TEXT,
  category VARCHAR(100),
  fan_count INTEGER DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  url VARCHAR(500),
  picture_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Facebook posts
CREATE TABLE facebook_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(100) UNIQUE NOT NULL,
  page_id UUID REFERENCES facebook_pages(id),
  message TEXT,
  created_time TIMESTAMP WITH TIME ZONE NOT NULL,
  permalink VARCHAR(500),
  picture_url VARCHAR(500),

  -- Engagement metrics
  reaction_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- Reaction breakdown
  like_count INTEGER DEFAULT 0,
  love_count INTEGER DEFAULT 0,
  haha_count INTEGER DEFAULT 0,
  wow_count INTEGER DEFAULT 0,
  sad_count INTEGER DEFAULT 0,
  angry_count INTEGER DEFAULT 0,

  -- Analysis
  sentiment_score NUMERIC(3,2),
  topics TEXT[],

  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fb_posts_page ON facebook_posts(page_id);
CREATE INDEX idx_fb_posts_created ON facebook_posts(created_time DESC);

-- Facebook comments
CREATE TABLE facebook_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR(100) UNIQUE NOT NULL,
  post_id UUID REFERENCES facebook_posts(id),
  parent_comment_id UUID REFERENCES facebook_comments(id),
  message TEXT NOT NULL,
  created_time TIMESTAMP WITH TIME ZONE NOT NULL,
  author_id VARCHAR(50),
  author_name VARCHAR(255),
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  sentiment_score NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fb_comments_post ON facebook_comments(post_id);
CREATE INDEX idx_fb_comments_created ON facebook_comments(created_time DESC);
```

---

## Scraping Fallback

For public content when API access is limited:

```typescript
// src/platforms/facebook/scraper.ts
import { V3 as Stagehand } from '@browserbasehq/stagehand';

export async function scrapePublicPage(pageUsername: string): Promise<FacebookPost[]> {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    await page.goto(`https://www.facebook.com/${pageUsername}`);
    await page.waitForSelector('[role="article"]', { timeout: 10000 });

    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    }

    // Extract posts
    const posts = await page.evaluate(() => {
      const articles = document.querySelectorAll('[role="article"]');
      const results: any[] = [];

      articles.forEach(article => {
        const textElement = article.querySelector('[data-ad-preview="message"]');
        const timeElement = article.querySelector('abbr');
        const linkElement = article.querySelector('a[href*="/posts/"]');

        if (textElement && timeElement) {
          results.push({
            message: textElement.textContent?.trim(),
            createdTime: timeElement.getAttribute('data-utime'),
            permalink: linkElement?.href
          });
        }
      });

      return results;
    });

    return posts;

  } catch (error) {
    console.error('Facebook scraping failed:', error);
    return [];
  } finally {
    await stagehand.close();
  }
}
```

**⚠️ Warning:** Web scraping Facebook may violate their Terms of Service. Use API when possible.

---

## Example: Monitor Political Parties

```typescript
// examples/monitor-dutch-parties.ts
import { FacebookAPI } from '../src/platforms/facebook/api';

async function monitorDutchParties() {
  const facebook = new FacebookAPI(process.env.FACEBOOK_ACCESS_TOKEN!);

  const parties = [
    { username: 'VVD', name: 'VVD' },
    { username: 'PvdA', name: 'PvdA' },
    { username: 'GroenLinks', name: 'GroenLinks' },
    { username: 'D66', name: 'D66' }
  ];

  for (const party of parties) {
    console.log(`\nMonitoring ${party.name}...`);

    // Get page info
    const pageInfo = await facebook.getPageInfo(party.username);
    console.log(`  Fans: ${pageInfo.fanCount.toLocaleString()}`);
    console.log(`  Category: ${pageInfo.category}`);

    // Get recent posts
    const posts = await facebook.getPagePosts(
      pageInfo.id,
      50,
      '2025-10-01'
    );

    console.log(`  Recent posts: ${posts.length}`);

    // Analyze engagement
    const totalEngagement = posts.reduce((sum, post) =>
      sum + post.metrics.reactions + post.metrics.comments + post.metrics.shares,
      0
    );

    console.log(`  Total engagement: ${totalEngagement.toLocaleString()}`);
    console.log(`  Avg per post: ${(totalEngagement / posts.length).toFixed(0)}`);

    // Get top post
    const topPost = posts.sort((a, b) =>
      (b.metrics.reactions + b.metrics.comments + b.metrics.shares) -
      (a.metrics.reactions + a.metrics.comments + a.metrics.shares)
    )[0];

    if (topPost) {
      console.log(`\n  Top post: "${topPost.message.substring(0, 100)}..."`);
      console.log(`    Reactions: ${topPost.metrics.reactions}`);
      console.log(`    Comments: ${topPost.metrics.comments}`);
      console.log(`    Shares: ${topPost.metrics.shares}`);

      // Get reaction breakdown
      const reactions = await facebook.getPostReactions(topPost.id);
      console.log(`    Breakdown: ${reactions.like}👍 ${reactions.love}❤️ ${reactions.angry}😠`);

      // Analyze comments
      const comments = await facebook.getPostComments(topPost.id, 100);
      const sentiments = comments.map(c => analyzeSentiment(c.message));
      const avgSentiment = sentiments.reduce((a, b) => a + b.score, 0) / sentiments.length;

      console.log(`    Comment sentiment: ${avgSentiment.toFixed(2)}`);
    }

    // Rate limiting
    await sleep(2000);
  }
}
```

---

## Rate Limiting

Facebook has multiple rate limit tiers:

| Tier | Calls/Hour | Cost |
|------|------------|------|
| **Standard** | 200 | Free |
| **Business** | Varies | Custom |

### Rate Limit Handler

```typescript
class FacebookRateLimiter {
  private callCounts: Map<string, number> = new Map();
  private resetTime: Date = new Date();

  async executeWithLimit<T>(
    resourceId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const count = this.callCounts.get(resourceId) || 0;

    if (count >= 200) {
      const waitTime = this.resetTime.getTime() - Date.now();
      if (waitTime > 0) {
        throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 60000)} minutes`);
      }
      // Reset
      this.callCounts.clear();
      this.resetTime = new Date(Date.now() + 3600000);
    }

    const result = await fn();
    this.callCounts.set(resourceId, count + 1);

    return result;
  }
}
```

---

## Privacy & GDPR

### Data Collection Rules

**Allowed:**
- ✅ Public page content
- ✅ Public group content (with API access)
- ✅ Public event information
- ✅ Aggregated engagement metrics

**Not Allowed:**
- ❌ Private user profiles
- ❌ Private groups
- ❌ User's friend lists
- ❌ Personal messages

### Data Retention

```sql
-- Auto-delete old Facebook data
CREATE OR REPLACE FUNCTION delete_old_facebook_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM facebook_comments
  WHERE created_at < NOW() - INTERVAL '90 days';

  DELETE FROM facebook_posts
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup
SELECT cron.schedule(
  'cleanup-facebook-posts',
  '0 3 * * *',
  'SELECT delete_old_facebook_posts()'
);
```

---

## Use Cases

### 1. Engagement Comparison

Compare engagement across political parties:

```typescript
async function comparePartyEngagement(pageIds: string[]) {
  const results = [];

  for (const pageId of pageIds) {
    const pageInfo = await facebook.getPageInfo(pageId);
    const posts = await facebook.getPagePosts(pageId, 30);

    const avgEngagement = posts.reduce((sum, post) =>
      sum + post.metrics.reactions + post.metrics.comments + post.metrics.shares,
      0
    ) / posts.length;

    const engagementRate = (avgEngagement / pageInfo.fanCount) * 100;

    results.push({
      name: pageInfo.name,
      fans: pageInfo.fanCount,
      avgEngagement,
      engagementRate
    });
  }

  results.sort((a, b) => b.engagementRate - a.engagementRate);
  console.table(results);
}
```

### 2. Sentiment Analysis

Analyze comment sentiment on political posts:

```typescript
async function analyzePostSentiment(postId: string) {
  const comments = await facebook.getPostComments(postId, 500);

  const sentiments = comments.map(c => {
    const analysis = analyzeSentiment(c.message);
    return {
      message: c.message.substring(0, 100),
      score: analysis.score,
      label: analysis.label
    };
  });

  const positive = sentiments.filter(s => s.label === 'positive').length;
  const negative = sentiments.filter(s => s.label === 'negative').length;
  const neutral = sentiments.filter(s => s.label === 'neutral').length;

  console.log('Sentiment Distribution:');
  console.log(`  Positive: ${(positive / sentiments.length * 100).toFixed(1)}%`);
  console.log(`  Negative: ${(negative / sentiments.length * 100).toFixed(1)}%`);
  console.log(`  Neutral: ${(neutral / sentiments.length * 100).toFixed(1)}%`);

  // Top concerns (negative comments)
  const concerns = sentiments
    .filter(s => s.label === 'negative')
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  console.log('\nTop Concerns:');
  concerns.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.message}...`);
  });
}
```

---

## Limitations

1. **API Access Requirements**
   - Need approved Facebook App
   - Page access tokens required
   - Limited to pages you manage (without Business API)

2. **Rate Limits**
   - 200 calls/hour per page (standard tier)
   - Batch requests count as multiple calls
   - Reaction breakdowns require separate calls

3. **Data Access**
   - Public content only
   - Limited historical data (few months)
   - Some metrics require page admin access

---

## Related Documentation

- [YouTube Extension](./youtube.md)
- [X/Twitter Extension](./twitter-x.md)
- [Instagram Extension](./instagram.md)
- [Social Media Overview](./social-media-overview.md)

---

[← Back to Documentation Index](../README.md)
