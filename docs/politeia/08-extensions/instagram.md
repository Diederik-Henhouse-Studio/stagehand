# Instagram Extension

Extend Politeia to monitor Instagram profiles, posts, stories, and hashtags for visual political content and civic engagement.

---

## Overview

Instagram Graph API integration enables:
- ✅ Business account monitoring
- ✅ Post and story tracking
- ✅ Hashtag analysis
- ✅ Comment extraction
- ✅ Engagement metrics
- ✅ Reels content monitoring

**Use Cases:**
- Monitor politician Instagram accounts
- Track political campaign visuals
- Analyze public engagement with civic content
- Monitor political events through stories
- Archive visual political communication

---

## Instagram Graph API Setup

### Authentication

Instagram Graph API requires a Facebook App with Instagram Basic Display or Instagram Graph API:

```typescript
// config/instagram-config.ts
export interface InstagramConfig {
  accessToken: string;
  apiUrl: string;
  version: string;
  accountType: 'business' | 'creator';
  rateLimits: {
    callsPerHour: number;
  };
}

const config: InstagramConfig = {
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN!,
  apiUrl: 'https://graph.instagram.com',
  version: 'v18.0',
  accountType: 'business',
  rateLimits: {
    callsPerHour: 200
  }
};
```

### Get API Access

**Option 1: Instagram Graph API (Business/Creator accounts)**

1. Create Facebook App at [developers.facebook.com](https://developers.facebook.com/)
2. Add Instagram Graph API product
3. Connect Instagram Business/Creator account to Facebook Page
4. Get User Access Token with permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
5. Generate Long-Lived Token (60 days)

**Option 2: Instagram Basic Display API (Personal accounts)**

1. Create Facebook App
2. Add Instagram Basic Display API
3. OAuth flow to get user token
4. Limited to basic profile and media

---

## Platform Configuration

```yaml
# config/platforms/instagram/v1.0.0.yaml
platform:
  type: INSTAGRAM
  version: "1.0.0"
  vendor: Meta

baseUrl: "https://www.instagram.com"
apiUrl: "https://graph.instagram.com"

features:
  - profile-info
  - media-feed
  - media-details
  - comments
  - hashtag-search
  - stories
  - reels

authentication:
  type: oauth2
  accountTypes:
    - business
    - creator
  rateLimits:
    callsPerHour: 200

extraction:
  methods:
    - api  # Business/Creator only
    - scraping  # Public profiles (limited)
```

---

## Request Types

### 1. Profile Monitoring

```typescript
interface ProfileMediaRequest {
  requestType: 'instagram-profile';
  requestId: string;
  account: {
    id?: string;  // Instagram Business Account ID
    username?: string;  // @username
  };
  parameters: {
    maxPosts?: number;
    since?: string;  // Unix timestamp
    mediaType?: 'image' | 'video' | 'carousel' | 'all';
    includeComments?: boolean;
  };
}
```

**Example:**
```json
{
  "requestType": "instagram-profile",
  "requestId": "uuid",
  "account": {
    "username": "vvd"
  },
  "parameters": {
    "maxPosts": 50,
    "since": "1696118400",
    "mediaType": "all",
    "includeComments": true
  }
}
```

### 2. Hashtag Monitoring

```typescript
interface HashtagSearchRequest {
  requestType: 'instagram-hashtag';
  requestId: string;
  hashtag: string;
  parameters: {
    maxPosts?: number;
  };
}
```

---

## API Implementation

### Profile Media

```typescript
// src/platforms/instagram/api.ts
import axios from 'axios';

export class InstagramAPI {
  private accessToken: string;
  private baseUrl = 'https://graph.instagram.com';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccountId(username: string): Promise<string> {
    // First, get Instagram Business Account ID from username
    // This requires the Facebook Page ID connected to the Instagram account
    // For simplicity, assume we have the IG account ID
    throw new Error('Username lookup requires Facebook Page connection');
  }

  async getAccountMedia(
    accountId: string,
    maxResults: number = 50,
    since?: string
  ): Promise<InstagramMedia[]> {
    const media: InstagramMedia[] = [];
    let nextUrl: string | undefined = `${this.baseUrl}/${accountId}/media`;

    do {
      const response = await axios.get(nextUrl, {
        params: {
          access_token: this.accessToken,
          fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count',
          limit: Math.min(maxResults - media.length, 100),
          ...(since && { since })
        }
      });

      for (const item of response.data.data) {
        media.push({
          id: item.id,
          caption: item.caption || '',
          mediaType: item.media_type,
          mediaUrl: item.media_url,
          permalink: item.permalink,
          thumbnailUrl: item.thumbnail_url,
          timestamp: item.timestamp,
          username: item.username,
          likeCount: item.like_count || 0,
          commentsCount: item.comments_count || 0
        });
      }

      nextUrl = response.data.paging?.next;
    } while (nextUrl && media.length < maxResults);

    return media;
  }

  async getMediaComments(
    mediaId: string,
    maxComments: number = 100
  ): Promise<InstagramComment[]> {
    const comments: InstagramComment[] = [];
    let nextUrl: string | undefined = `${this.baseUrl}/${mediaId}/comments`;

    do {
      const response = await axios.get(nextUrl, {
        params: {
          access_token: this.accessToken,
          fields: 'id,text,timestamp,username,like_count,replies',
          limit: Math.min(maxComments - comments.length, 100)
        }
      });

      for (const comment of response.data.data) {
        comments.push({
          id: comment.id,
          text: comment.text,
          timestamp: comment.timestamp,
          username: comment.username,
          likeCount: comment.like_count || 0,
          replyCount: comment.replies?.data?.length || 0
        });
      }

      nextUrl = response.data.paging?.next;
    } while (nextUrl && comments.length < maxComments);

    return comments;
  }

  async getAccountInfo(accountId: string): Promise<InstagramAccount> {
    const response = await axios.get(`${this.baseUrl}/${accountId}`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url'
      }
    });

    return {
      id: response.data.id,
      username: response.data.username,
      name: response.data.name,
      biography: response.data.biography,
      followersCount: response.data.followers_count,
      followsCount: response.data.follows_count,
      mediaCount: response.data.media_count,
      profilePictureUrl: response.data.profile_picture_url
    };
  }

  async searchHashtag(hashtag: string): Promise<string> {
    // Get hashtag ID
    const response = await axios.get(`${this.baseUrl}/ig_hashtag_search`, {
      params: {
        access_token: this.accessToken,
        user_id: this.userId,  // IG Business Account ID
        q: hashtag
      }
    });

    return response.data.data[0]?.id;
  }

  async getHashtagMedia(
    hashtagId: string,
    maxResults: number = 50
  ): Promise<InstagramMedia[]> {
    const response = await axios.get(
      `${this.baseUrl}/${hashtagId}/top_media`,
      {
        params: {
          access_token: this.accessToken,
          user_id: this.userId,
          fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
          limit: Math.min(maxResults, 50)  // Max 50 for hashtag search
        }
      }
    );

    return response.data.data.map((item: any) => ({
      id: item.id,
      caption: item.caption || '',
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      permalink: item.permalink,
      timestamp: item.timestamp,
      likeCount: item.like_count || 0,
      commentsCount: item.comments_count || 0
    }));
  }

  async getStories(accountId: string): Promise<InstagramMedia[]> {
    const response = await axios.get(`${this.baseUrl}/${accountId}/stories`, {
      params: {
        access_token: this.accessToken,
        fields: 'id,media_type,media_url,permalink,timestamp'
      }
    });

    return response.data.data || [];
  }
}
```

### Instagram Insights

For business accounts, get engagement insights:

```typescript
async function getMediaInsights(mediaId: string): Promise<InstagramInsights> {
  const response = await axios.get(
    `https://graph.instagram.com/${mediaId}/insights`,
    {
      params: {
        access_token: this.accessToken,
        metric: 'engagement,impressions,reach,saved'
      }
    }
  );

  const insights: InstagramInsights = {
    engagement: 0,
    impressions: 0,
    reach: 0,
    saved: 0
  };

  for (const metric of response.data.data) {
    insights[metric.name] = metric.values[0].value;
  }

  return insights;
}
```

---

## Data Models

### Supabase Schema

```sql
-- Instagram accounts
CREATE TABLE instagram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  biography TEXT,
  followers_count INTEGER DEFAULT 0,
  follows_count INTEGER DEFAULT 0,
  media_count INTEGER DEFAULT 0,
  profile_picture_url VARCHAR(500),
  account_type VARCHAR(20),  -- 'business', 'creator', 'personal'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instagram media
CREATE TABLE instagram_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id VARCHAR(50) UNIQUE NOT NULL,
  account_id UUID REFERENCES instagram_accounts(id),
  caption TEXT,
  media_type VARCHAR(20),  -- 'IMAGE', 'VIDEO', 'CAROUSEL_ALBUM', 'STORY'
  media_url VARCHAR(1000),
  permalink VARCHAR(500),
  thumbnail_url VARCHAR(500),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Engagement metrics
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- Insights (business accounts only)
  impressions INTEGER,
  reach INTEGER,
  engagement INTEGER,
  saved INTEGER,

  -- Analysis
  sentiment_score NUMERIC(3,2),
  topics TEXT[],

  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ig_media_account ON instagram_media(account_id);
CREATE INDEX idx_ig_media_timestamp ON instagram_media(timestamp DESC);

-- Instagram comments
CREATE TABLE instagram_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR(50) UNIQUE NOT NULL,
  media_id UUID REFERENCES instagram_media(id),
  parent_comment_id UUID REFERENCES instagram_comments(id),
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  username VARCHAR(100),
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  sentiment_score NUMERIC(3,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ig_comments_media ON instagram_comments(media_id);
CREATE INDEX idx_ig_comments_timestamp ON instagram_comments(timestamp DESC);
```

---

## Scraping Fallback

For public profiles when API access is unavailable:

```typescript
// src/platforms/instagram/scraper.ts
import { V3 as Stagehand } from '@browserbasehq/stagehand';

export async function scrapePublicProfile(username: string): Promise<InstagramMedia[]> {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    await page.goto(`https://www.instagram.com/${username}/`);
    await page.waitForSelector('article img', { timeout: 10000 });

    // Scroll to load more posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(2000);
    }

    // Extract post data
    const posts = await page.evaluate(() => {
      const articles = document.querySelectorAll('article a[href*="/p/"]');
      const results: any[] = [];

      articles.forEach(link => {
        const img = link.querySelector('img');
        if (img) {
          results.push({
            permalink: (link as HTMLAnchorElement).href,
            mediaUrl: img.src,
            caption: img.alt
          });
        }
      });

      return results;
    });

    return posts;

  } catch (error) {
    console.error('Instagram scraping failed:', error);
    return [];
  } finally {
    await stagehand.close();
  }
}
```

**⚠️ Limitations:**
- Instagram aggressively blocks scrapers
- Requires login for most content
- Rate limiting is strict
- Violates Instagram's Terms of Service

---

## Example: Monitor Politicians

```typescript
// examples/monitor-politicians-instagram.ts
import { InstagramAPI } from '../src/platforms/instagram/api';

async function monitorPoliticians() {
  const instagram = new InstagramAPI(process.env.INSTAGRAM_ACCESS_TOKEN!);

  const politicians = [
    { accountId: '123', username: 'markrutte' },
    { accountId: '456', username: 'jesseklaver' }
  ];

  for (const politician of politicians) {
    console.log(`\nMonitoring @${politician.username}...`);

    // Get account info
    const account = await instagram.getAccountInfo(politician.accountId);
    console.log(`  Followers: ${account.followersCount.toLocaleString()}`);
    console.log(`  Posts: ${account.mediaCount}`);

    // Get recent media
    const media = await instagram.getAccountMedia(
      politician.accountId,
      30
    );

    console.log(`  Recent posts: ${media.length}`);

    // Calculate engagement rate
    const totalEngagement = media.reduce((sum, post) =>
      sum + post.likeCount + post.commentsCount,
      0
    );

    const avgEngagement = totalEngagement / media.length;
    const engagementRate = (avgEngagement / account.followersCount) * 100;

    console.log(`  Avg engagement: ${avgEngagement.toFixed(0)}`);
    console.log(`  Engagement rate: ${engagementRate.toFixed(2)}%`);

    // Get top post
    const topPost = media.sort((a, b) =>
      (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount)
    )[0];

    if (topPost) {
      console.log(`\n  Top post: "${topPost.caption.substring(0, 100)}..."`);
      console.log(`    Likes: ${topPost.likeCount.toLocaleString()}`);
      console.log(`    Comments: ${topPost.commentsCount}`);
      console.log(`    URL: ${topPost.permalink}`);

      // Get insights (if business account)
      try {
        const insights = await instagram.getMediaInsights(topPost.id);
        console.log(`    Impressions: ${insights.impressions.toLocaleString()}`);
        console.log(`    Reach: ${insights.reach.toLocaleString()}`);
      } catch (error) {
        console.log('    (Insights not available)');
      }

      // Analyze comments
      const comments = await instagram.getMediaComments(topPost.id, 100);
      const sentiments = comments.map(c => analyzeSentiment(c.text));
      const avgSentiment = sentiments.reduce((a, b) => a + b.score, 0) / sentiments.length;

      console.log(`    Comment sentiment: ${avgSentiment.toFixed(2)}`);
    }

    // Rate limiting
    await sleep(2000);
  }
}
```

---

## Hashtag Monitoring

Track political hashtags:

```typescript
async function monitorPoliticalHashtags() {
  const hashtags = ['klimaatactie', 'stemmen2025', 'participatie'];

  for (const tag of hashtags) {
    console.log(`\nTracking #${tag}...`);

    const hashtagId = await instagram.searchHashtag(tag);
    const media = await instagram.getHashtagMedia(hashtagId, 50);

    console.log(`  Found ${media.length} posts`);

    // Analyze posting frequency
    const now = Date.now();
    const last24h = media.filter(m =>
      now - new Date(m.timestamp).getTime() < 86400000
    ).length;

    console.log(`  Posts in last 24h: ${last24h}`);

    // Get top posts
    const topPosts = media
      .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
      .slice(0, 5);

    console.log('\n  Top posts:');
    topPosts.forEach((post, i) => {
      console.log(`    ${i + 1}. @${post.username}: ${post.likeCount} likes`);
      console.log(`       ${post.caption.substring(0, 80)}...`);
    });
  }
}
```

---

## Rate Limiting

Instagram Graph API limits:

| Endpoint | Rate Limit |
|----------|------------|
| **User Media** | 200 calls/hour |
| **Media Comments** | 200 calls/hour |
| **Hashtag Search** | 30 calls/hour |
| **Insights** | 200 calls/hour |

### Rate Limiter

```typescript
class InstagramRateLimiter {
  private callCounts: Map<string, number> = new Map();
  private resetTime: Date = new Date(Date.now() + 3600000);

  async executeWithLimit<T>(
    endpoint: string,
    limit: number,
    fn: () => Promise<T>
  ): Promise<T> {
    if (Date.now() >= this.resetTime.getTime()) {
      this.callCounts.clear();
      this.resetTime = new Date(Date.now() + 3600000);
    }

    const count = this.callCounts.get(endpoint) || 0;

    if (count >= limit) {
      const waitMinutes = Math.ceil((this.resetTime.getTime() - Date.now()) / 60000);
      throw new Error(`Rate limit exceeded for ${endpoint}. Wait ${waitMinutes} minutes.`);
    }

    const result = await fn();
    this.callCounts.set(endpoint, count + 1);

    return result;
  }
}
```

---

## Limitations

1. **Account Requirements**
   - Must be Business or Creator account for Graph API
   - Requires Facebook Page connection
   - Personal accounts have limited API access

2. **API Restrictions**
   - Hashtag search limited to 30 calls/hour
   - Top 50 posts only for hashtag search
   - No access to other users' Stories
   - Limited historical data

3. **Content Access**
   - Public content only
   - Cannot access private profiles
   - Cannot access DMs
   - Story content expires after 24 hours

4. **Scraping Challenges**
   - Instagram actively blocks scrapers
   - Most content requires login
   - Aggressive rate limiting
   - Frequent DOM structure changes

---

## Best Practices

1. **Use Official API** - Always prefer Graph API over scraping
2. **Cache Responses** - Reduce API calls by caching for 1 hour
3. **Monitor Rate Limits** - Track API usage to avoid hitting limits
4. **Respect Privacy** - Only collect public content
5. **Handle Errors** - Instagram API can be unreliable

---

## Related Documentation

- [YouTube Extension](./youtube.md)
- [X/Twitter Extension](./twitter-x.md)
- [Facebook Extension](./facebook.md)
- [Social Media Overview](./social-media-overview.md)

---

[← Back to Documentation Index](../README.md)
