# X (Twitter) Extension

Extend Politeia to monitor X (formerly Twitter) for political discourse, public opinion, and real-time civic engagement.

---

## Overview

X/Twitter integration enables:
- ✅ User timeline monitoring
- ✅ Tweet search and filtering
- ✅ Thread extraction
- ✅ Engagement metrics tracking
- ✅ Real-time stream monitoring
- ✅ Political sentiment analysis

**Use Cases:**
- Monitor politician accounts
- Track political hashtags
- Analyze public sentiment on policies
- Detect trending civic issues
- Archive political statements

---

## X API Setup

### Authentication

X API v2 requires OAuth 2.0 Bearer Token authentication:

```typescript
// config/twitter-config.ts
export interface TwitterConfig {
  bearerToken: string;
  apiUrl: string;
  tier: 'free' | 'basic' | 'pro' | 'enterprise';
  rateLimits: {
    tweets: number;  // requests per 15 min
    users: number;
  };
}

const config: TwitterConfig = {
  bearerToken: process.env.TWITTER_BEARER_TOKEN!,
  apiUrl: 'https://api.twitter.com/2',
  tier: 'basic',
  rateLimits: {
    tweets: 450,
    users: 300
  }
};
```

### Get API Access

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create new project: "Politeia Social Monitor"
3. Create app and generate Bearer Token
4. Choose tier based on needs:
   - **Free**: 1,500 tweets/month (not suitable for production)
   - **Basic**: $100/month, 10K tweets/month, real-time search
   - **Pro**: $5,000/month, 1M tweets/month, full archive
   - **Enterprise**: Custom pricing, unlimited access

---

## Platform Configuration

```yaml
# config/platforms/twitter/v1.0.0.yaml
platform:
  type: TWITTER_X
  version: "1.0.0"
  vendor: X Corp

baseUrl: "https://twitter.com"
apiUrl: "https://api.twitter.com/2"

features:
  - user-timeline
  - tweet-search
  - user-lookup
  - followers
  - mentions
  - trending
  - spaces  # Audio conversations

authentication:
  type: oauth2-bearer
  tier: basic
  rateLimits:
    tweetsPerWindow: 450  # per 15 minutes
    usersPerWindow: 300

extraction:
  methods:
    - api  # Primary method
    - scraping  # Fallback (violates TOS, use carefully)
```

---

## Request Types

### 1. User Timeline Monitoring

```typescript
interface UserTimelineRequest {
  requestType: 'twitter-timeline';
  requestId: string;
  user: {
    id?: string;  // Preferred
    username?: string;  // e.g., '@vvd'
  };
  parameters: {
    maxTweets?: number;
    sinceId?: string;  // Get tweets after this ID
    startTime?: string;  // ISO 8601
    excludeReplies?: boolean;
    excludeRetweets?: boolean;
    includeMetrics?: boolean;
  };
}
```

**Example:**
```json
{
  "requestType": "twitter-timeline",
  "requestId": "uuid",
  "user": {
    "username": "@vvd"
  },
  "parameters": {
    "maxTweets": 100,
    "startTime": "2025-10-01T00:00:00Z",
    "excludeRetweets": true,
    "includeMetrics": true
  }
}
```

### 2. Search Tweets

```typescript
interface TweetSearchRequest {
  requestType: 'twitter-search';
  requestId: string;
  query: string;  // Twitter search syntax
  parameters: {
    maxResults?: number;
    startTime?: string;
    endTime?: string;
    sortOrder?: 'recency' | 'relevancy';
  };
}
```

**Example:**
```json
{
  "requestType": "twitter-search",
  "requestId": "uuid",
  "query": "(klimaatbeleid OR klimaatwet) lang:nl -is:retweet",
  "parameters": {
    "maxResults": 100,
    "startTime": "2025-10-01T00:00:00Z",
    "sortOrder": "recency"
  }
}
```

---

## API Implementation

### User Timeline

```typescript
// src/platforms/twitter/api.ts
import axios from 'axios';

export class TwitterAPI {
  private bearerToken: string;
  private baseUrl = 'https://api.twitter.com/2';

  constructor(bearerToken: string) {
    this.bearerToken = bearerToken;
  }

  async getUserTimeline(
    userId: string,
    maxResults: number = 100,
    startTime?: string
  ): Promise<Tweet[]> {
    const response = await axios.get(
      `${this.baseUrl}/users/${userId}/tweets`,
      {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        },
        params: {
          max_results: Math.min(maxResults, 100),
          'tweet.fields': 'created_at,public_metrics,entities,referenced_tweets',
          'user.fields': 'name,username,verified',
          expansions: 'author_id,referenced_tweets.id',
          ...(startTime && { start_time: startTime })
        }
      }
    );

    return this.parseTweets(response.data);
  }

  async searchTweets(
    query: string,
    maxResults: number = 100,
    startTime?: string
  ): Promise<Tweet[]> {
    const tweets: Tweet[] = [];
    let nextToken: string | undefined;

    do {
      const response = await axios.get(
        `${this.baseUrl}/tweets/search/recent`,
        {
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`
          },
          params: {
            query,
            max_results: Math.min(maxResults - tweets.length, 100),
            'tweet.fields': 'created_at,public_metrics,entities,lang',
            'user.fields': 'name,username,verified,public_metrics',
            expansions: 'author_id',
            ...(startTime && { start_time: startTime }),
            ...(nextToken && { next_token: nextToken })
          }
        }
      );

      const parsedTweets = this.parseTweets(response.data);
      tweets.push(...parsedTweets);

      nextToken = response.data.meta?.next_token;
    } while (nextToken && tweets.length < maxResults);

    return tweets;
  }

  async getUserByUsername(username: string): Promise<TwitterUser> {
    // Remove @ if present
    const cleanUsername = username.replace('@', '');

    const response = await axios.get(
      `${this.baseUrl}/users/by/username/${cleanUsername}`,
      {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        },
        params: {
          'user.fields': 'created_at,description,public_metrics,verified'
        }
      }
    );

    return {
      id: response.data.data.id,
      username: response.data.data.username,
      name: response.data.data.name,
      verified: response.data.data.verified,
      followersCount: response.data.data.public_metrics.followers_count,
      followingCount: response.data.data.public_metrics.following_count,
      tweetCount: response.data.data.public_metrics.tweet_count
    };
  }

  private parseTweets(data: any): Tweet[] {
    if (!data.data) return [];

    const users = new Map(
      (data.includes?.users || []).map((u: any) => [u.id, u])
    );

    return data.data.map((tweet: any) => {
      const author = users.get(tweet.author_id);

      return {
        id: tweet.id,
        text: tweet.text,
        createdAt: tweet.created_at,
        author: {
          id: author?.id,
          username: author?.username,
          name: author?.name,
          verified: author?.verified
        },
        metrics: {
          retweets: tweet.public_metrics?.retweet_count || 0,
          likes: tweet.public_metrics?.like_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          quotes: tweet.public_metrics?.quote_count || 0
        },
        entities: tweet.entities,
        isRetweet: tweet.referenced_tweets?.some((ref: any) => ref.type === 'retweeted'),
        isReply: tweet.referenced_tweets?.some((ref: any) => ref.type === 'replied_to')
      };
    });
  }
}
```

### Thread Extraction

```typescript
// src/platforms/twitter/threads.ts
export async function extractThread(
  api: TwitterAPI,
  initialTweetId: string
): Promise<Tweet[]> {
  const thread: Tweet[] = [];
  let currentId = initialTweetId;

  while (currentId) {
    const tweet = await api.getTweetById(currentId);
    thread.push(tweet);

    // Check if this tweet is a reply to another tweet by same author
    const replyTo = tweet.referencedTweets?.find(ref => ref.type === 'replied_to');
    if (replyTo) {
      const parentTweet = await api.getTweetById(replyTo.id);
      if (parentTweet.author.id === tweet.author.id) {
        currentId = replyTo.id;
      } else {
        break;  // Reply to different user, not part of thread
      }
    } else {
      break;  // No more replies
    }
  }

  return thread.reverse();  // Return in chronological order
}
```

---

## Data Models

### Supabase Schema

```sql
-- Twitter users
CREATE TABLE twitter_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) UNIQUE NOT NULL,
  username VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT false,
  description TEXT,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  tweet_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Twitter tweets
CREATE TABLE twitter_tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES twitter_users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Engagement metrics
  retweet_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,

  -- Type flags
  is_retweet BOOLEAN DEFAULT false,
  is_reply BOOLEAN DEFAULT false,
  is_quote BOOLEAN DEFAULT false,

  -- References
  replied_to_tweet_id VARCHAR(50),
  retweeted_tweet_id VARCHAR(50),
  quoted_tweet_id VARCHAR(50),

  -- Analysis
  sentiment_score NUMERIC(3,2),
  topics TEXT[],
  language VARCHAR(5),

  -- Metadata
  entities JSONB,
  url VARCHAR(500),

  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tweets_user ON twitter_tweets(user_id);
CREATE INDEX idx_tweets_created ON twitter_tweets(created_at DESC);
CREATE INDEX idx_tweets_topics ON twitter_tweets USING GIN(topics);
```

---

## Rate Limiting

X API has strict rate limits that vary by tier:

| Endpoint | Free | Basic | Pro |
|----------|------|-------|-----|
| **User Timeline** | 1,500 tweets/month | 10,000/month | 1M/month |
| **Tweet Search** | N/A | 10,000/month | 1M/month |
| **User Lookup** | 300/15min | 300/15min | 900/15min |
| **Monthly Cost** | $0 | $100 | $5,000 |

### Rate Limit Handler

```typescript
class RateLimitHandler {
  private requestCounts: Map<string, number> = new Map();
  private resetTimes: Map<string, Date> = new Map();

  async executeWithRateLimit<T>(
    endpoint: string,
    fn: () => Promise<T>,
    limit: number,
    window: number = 900000  // 15 minutes
  ): Promise<T> {
    const now = Date.now();
    const resetTime = this.resetTimes.get(endpoint);

    // Reset counter if window expired
    if (resetTime && now >= resetTime.getTime()) {
      this.requestCounts.set(endpoint, 0);
      this.resetTimes.set(endpoint, new Date(now + window));
    }

    const count = this.requestCounts.get(endpoint) || 0;

    if (count >= limit) {
      const waitTime = this.resetTimes.get(endpoint)!.getTime() - now;
      throw new Error(`Rate limit exceeded. Retry in ${Math.ceil(waitTime / 1000)}s`);
    }

    const result = await fn();
    this.requestCounts.set(endpoint, count + 1);

    return result;
  }
}
```

---

## Example: Monitor Dutch Politicians

```typescript
// examples/monitor-dutch-politicians.ts
import { TwitterAPI } from '../src/platforms/twitter/api';

async function monitorDutchPoliticians() {
  const twitter = new TwitterAPI(process.env.TWITTER_BEARER_TOKEN!);

  const politicians = [
    { username: '@vvd', name: 'VVD' },
    { username: '@pvda', name: 'PvdA' },
    { username: '@groenlinks', name: 'GroenLinks' },
    { username: '@D66', name: 'D66' }
  ];

  for (const politician of politicians) {
    console.log(`\nMonitoring ${politician.name}...`);

    // Get user info
    const user = await twitter.getUserByUsername(politician.username);
    console.log(`  Followers: ${user.followersCount.toLocaleString()}`);
    console.log(`  Total tweets: ${user.tweetCount.toLocaleString()}`);

    // Get recent tweets
    const tweets = await twitter.getUserTimeline(
      user.id,
      50,
      '2025-10-01T00:00:00Z'
    );

    console.log(`  Recent tweets: ${tweets.length}`);

    // Analyze sentiment
    let totalSentiment = 0;
    for (const tweet of tweets) {
      const sentiment = await analyzeSentiment(tweet.text);
      totalSentiment += sentiment.score;

      await database.storeTweet({
        tweetId: tweet.id,
        userId: user.id,
        text: tweet.text,
        createdAt: tweet.createdAt,
        metrics: tweet.metrics,
        sentimentScore: sentiment.score
      });
    }

    const avgSentiment = totalSentiment / tweets.length;
    console.log(`  Avg sentiment: ${avgSentiment.toFixed(2)}`);

    // Rate limiting
    await sleep(1000);
  }
}
```

---

## Real-Time Monitoring

### Filtered Stream

For real-time monitoring of specific keywords/hashtags:

```typescript
// src/platforms/twitter/stream.ts
import { EventEmitter } from 'events';

export class TwitterStream extends EventEmitter {
  private api: TwitterAPI;

  async addRule(value: string, tag: string) {
    await axios.post(
      'https://api.twitter.com/2/tweets/search/stream/rules',
      {
        add: [{ value, tag }]
      },
      {
        headers: {
          'Authorization': `Bearer ${this.api.bearerToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  async connect() {
    const response = await axios.get(
      'https://api.twitter.com/2/tweets/search/stream',
      {
        headers: {
          'Authorization': `Bearer ${this.api.bearerToken}`
        },
        params: {
          'tweet.fields': 'created_at,public_metrics',
          'user.fields': 'username,verified',
          expansions: 'author_id'
        },
        responseType: 'stream'
      }
    );

    response.data.on('data', (chunk: Buffer) => {
      const tweet = JSON.parse(chunk.toString());
      this.emit('tweet', tweet);
    });

    response.data.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }
}

// Usage
const stream = new TwitterStream(twitter);

await stream.addRule('klimaatbeleid lang:nl', 'climate-policy');
await stream.addRule('gemeenteraad lang:nl', 'municipal-council');

stream.on('tweet', async (tweet) => {
  console.log(`New tweet: ${tweet.data.text}`);
  await processTweet(tweet);
});

stream.connect();
```

---

## Use Cases

### 1. Political Hashtag Tracking

Track trending political hashtags and analyze discourse:

```typescript
async function trackPoliticalHashtags() {
  const hashtags = ['#klimaatbeleid', '#woningmarkt', '#zorg'];

  for (const hashtag of hashtags) {
    const tweets = await twitter.searchTweets(
      `${hashtag} lang:nl -is:retweet`,
      1000,
      '2025-10-01T00:00:00Z'
    );

    // Sentiment distribution
    const sentiments = tweets.map(t => analyzeSentiment(t.text));
    const positive = sentiments.filter(s => s.score > 0.2).length;
    const negative = sentiments.filter(s => s.score < -0.2).length;
    const neutral = sentiments.length - positive - negative;

    console.log(`${hashtag}:`);
    console.log(`  Positive: ${(positive / sentiments.length * 100).toFixed(1)}%`);
    console.log(`  Negative: ${(negative / sentiments.length * 100).toFixed(1)}%`);
    console.log(`  Neutral: ${(neutral / sentiments.length * 100).toFixed(1)}%`);
  }
}
```

### 2. Crisis Detection

Detect sudden spikes in negative sentiment:

```typescript
async function detectCrisis(topic: string) {
  const window = 3600000;  // 1 hour
  const threshold = -0.5;

  setInterval(async () => {
    const tweets = await twitter.searchTweets(
      `${topic} lang:nl`,
      100
    );

    const avgSentiment = tweets
      .map(t => analyzeSentiment(t.text).score)
      .reduce((a, b) => a + b, 0) / tweets.length;

    if (avgSentiment < threshold) {
      await sendAlert({
        topic,
        sentiment: avgSentiment,
        tweetCount: tweets.length,
        topTweets: tweets.slice(0, 5)
      });
    }
  }, window);
}
```

### 3. Politician Engagement Analysis

Compare engagement across politicians:

```typescript
async function analyzeEngagement(politicians: string[]) {
  const results = [];

  for (const username of politicians) {
    const user = await twitter.getUserByUsername(username);
    const tweets = await twitter.getUserTimeline(user.id, 100);

    const totalEngagement = tweets.reduce((sum, tweet) =>
      sum + tweet.metrics.likes + tweet.metrics.retweets + tweet.metrics.replies,
      0
    );

    const avgEngagement = totalEngagement / tweets.length;
    const engagementRate = (avgEngagement / user.followersCount) * 100;

    results.push({
      username,
      followers: user.followersCount,
      avgEngagement,
      engagementRate
    });
  }

  // Sort by engagement rate
  results.sort((a, b) => b.engagementRate - a.engagementRate);

  console.table(results);
}
```

---

## Privacy & Compliance

### Data Collection

**Allowed:**
- ✅ Public tweets and profiles
- ✅ Public engagement metrics
- ✅ Publicly shared location data

**Not Allowed:**
- ❌ Protected/private accounts
- ❌ Direct messages
- ❌ Private user data

### GDPR Compliance

```typescript
// Anonymize user data for analysis
interface AnonymizedTweet {
  tweetId: string;
  textHash: string;  // Hash of original text
  sentimentScore: number;
  topics: string[];
  createdAt: Date;
  // NO username, user ID, or identifiable information
}

function anonymizeTweet(tweet: Tweet): AnonymizedTweet {
  return {
    tweetId: hashId(tweet.id),
    textHash: hashText(tweet.text),
    sentimentScore: tweet.sentimentScore,
    topics: tweet.topics,
    createdAt: tweet.createdAt
  };
}
```

---

## Cost Optimization

### Strategies

1. **Cache API responses** for 1 hour to reduce duplicate requests
2. **Use search instead of timeline** when monitoring multiple accounts
3. **Batch user lookups** (up to 100 users per request)
4. **Filter by language** to reduce irrelevant tweets
5. **Use pagination wisely** - don't over-fetch

### Cost Calculator

```typescript
function calculateMonthlyCost(
  politiciansCount: number,
  tweetsPerPoliticianPerDay: number,
  searchQueriesPerDay: number
): number {
  const timelineTweets = politiciansCount * tweetsPerPoliticianPerDay * 30;
  const searchTweets = searchQueriesPerDay * 100 * 30;  // 100 tweets per search

  const totalTweets = timelineTweets + searchTweets;

  if (totalTweets <= 1500) return 0;  // Free tier
  if (totalTweets <= 10000) return 100;  // Basic tier
  if (totalTweets <= 1000000) return 5000;  // Pro tier

  return 5000 + ((totalTweets - 1000000) / 1000000) * 5000;  // Enterprise
}

// Example
const cost = calculateMonthlyCost(10, 5, 5);
console.log(`Estimated monthly cost: $${cost}`);
```

---

## Related Documentation

- [YouTube Extension](./youtube.md)
- [Facebook Extension](./facebook.md)
- [Instagram Extension](./instagram.md)
- [Social Media Overview](./social-media-overview.md)

---

[← Back to Documentation Index](../README.md)
