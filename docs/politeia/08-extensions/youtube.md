# YouTube Extension

Extend Politeia to scrape YouTube channels, videos, and comments for political content analysis.

---

## Overview

YouTube integration enables:
- ✅ Channel monitoring
- ✅ Video metadata extraction
- ✅ Comment analysis
- ✅ Transcript extraction
- ✅ Political speech tracking

**Use Cases:**
- Monitor politician YouTube channels
- Track government press conferences
- Analyze public opinion via comments
- Archive political speeches

---

## YouTube API Setup

### Authentication

```typescript
// config/youtube-config.ts
export interface YouTubeConfig {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  quotaLimit: number;
}

const config: YouTubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY!,
  quotaLimit: 10000 // units per day
};
```

### Get API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "Politeia YouTube"
3. Enable YouTube Data API v3
4. Create credentials → API Key
5. Restrict API key to YouTube Data API

---

## Platform Configuration

```yaml
# config/platforms/youtube/v1.0.0.yaml
platform:
  type: YOUTUBE
  version: "1.0.0"
  vendor: Google

baseUrl: "https://www.youtube.com"
apiUrl: "https://www.googleapis.com/youtube/v3"

features:
  - channel-info
  - video-list
  - video-details
  - comments
  - transcripts
  - live-streams

authentication:
  type: api-key
  quotaPerDay: 10000

extraction:
  methods:
    - api  # Preferred
    - scraping  # Fallback for transcripts
```

---

## Request Types

### 1. Channel Monitoring

```typescript
interface ChannelMonitorRequest {
  requestType: 'youtube-channel';
  requestId: string;
  channel: {
    id?: string;  // e.g., 'UCxxx'
    username?: string;  // e.g., '@minpres'
    customUrl?: string;  // e.g., 'c/Rijksoverheid'
  };
  parameters: {
    maxVideos?: number;
    publishedAfter?: string;  // ISO 8601
    order?: 'date' | 'viewCount' | 'rating';
  };
}
```

**Example:**
```json
{
  "requestType": "youtube-channel",
  "requestId": "uuid",
  "channel": {
    "customUrl": "c/Rijksoverheid"
  },
  "parameters": {
    "maxVideos": 50,
    "publishedAfter": "2025-10-01T00:00:00Z",
    "order": "date"
  }
}
```

### 2. Video Details

```typescript
interface VideoDetailsRequest {
  requestType: 'youtube-video';
  requestId: string;
  videoId: string;
  extractionOptions: {
    includeComments: boolean;
    includeTranscript: boolean;
    maxComments?: number;
  };
}
```

---

## API Implementation

### Channel Videos

```typescript
// src/platforms/youtube/api.ts
import axios from 'axios';

export class YouTubeAPI {
  private apiKey: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getChannelVideos(
    channelId: string,
    maxResults: number = 50,
    publishedAfter?: string
  ): Promise<YouTubeVideo[]> {
    // 1. Get uploads playlist ID
    const channelResponse = await axios.get(`${this.baseUrl}/channels`, {
      params: {
        part: 'contentDetails',
        id: channelId,
        key: this.apiKey
      }
    });

    const uploadsPlaylistId = channelResponse.data.items[0]
      .contentDetails.relatedPlaylists.uploads;

    // 2. Get videos from uploads playlist
    const playlistResponse = await axios.get(`${this.baseUrl}/playlistItems`, {
      params: {
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults,
        ...(publishedAfter && { publishedAfter }),
        key: this.apiKey
      }
    });

    return playlistResponse.data.items.map(item => ({
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle
    }));
  }

  async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails> {
    const response = await axios.get(`${this.baseUrl}/videos`, {
      params: {
        part: 'snippet,contentDetails,statistics,liveStreamingDetails',
        id: videoId,
        key: this.apiKey
      }
    });

    const video = response.data.items[0];
    return {
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      publishedAt: video.snippet.publishedAt,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      duration: video.contentDetails.duration,
      viewCount: parseInt(video.statistics.viewCount),
      likeCount: parseInt(video.statistics.likeCount),
      commentCount: parseInt(video.statistics.commentCount),
      isLiveStream: !!video.liveStreamingDetails,
      tags: video.snippet.tags || []
    };
  }

  async getVideoComments(
    videoId: string,
    maxResults: number = 100
  ): Promise<YouTubeComment[]> {
    const comments: YouTubeComment[] = [];
    let pageToken: string | undefined;

    do {
      const response = await axios.get(`${this.baseUrl}/commentThreads`, {
        params: {
          part: 'snippet,replies',
          videoId,
          maxResults: Math.min(maxResults - comments.length, 100),
          order: 'relevance',
          textFormat: 'plainText',
          ...(pageToken && { pageToken }),
          key: this.apiKey
        }
      });

      for (const thread of response.data.items) {
        const topComment = thread.snippet.topLevelComment.snippet;

        comments.push({
          id: thread.id,
          author: topComment.authorDisplayName,
          authorChannelId: topComment.authorChannelId?.value,
          text: topComment.textDisplay,
          likeCount: topComment.likeCount,
          publishedAt: topComment.publishedAt,
          isReply: false,
          replyCount: thread.snippet.totalReplyCount
        });

        // Add replies if present
        if (thread.replies) {
          for (const reply of thread.replies.comments) {
            comments.push({
              id: reply.id,
              author: reply.snippet.authorDisplayName,
              authorChannelId: reply.snippet.authorChannelId?.value,
              text: reply.snippet.textDisplay,
              likeCount: reply.snippet.likeCount,
              publishedAt: reply.snippet.publishedAt,
              isReply: true,
              parentId: thread.id
            });
          }
        }
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken && comments.length < maxResults);

    return comments;
  }
}
```

### Transcript Extraction

YouTube API doesn't provide transcripts, so use scraping:

```typescript
// src/platforms/youtube/transcript.ts
import { V3 as Stagehand } from '@browserbasehq/stagehand';

export async function getVideoTranscript(videoId: string): Promise<string | null> {
  const stagehand = new Stagehand({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID
  });

  try {
    await stagehand.init();
    const page = stagehand.context.pages()[0];

    // Navigate to video
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`);
    await page.waitForSelector('button[aria-label*="transcript"]', { timeout: 5000 });

    // Click "Show transcript" button
    await page.click('button[aria-label*="transcript"]');
    await page.waitForTimeout(2000);

    // Extract transcript
    const transcript = await page.evaluate(() => {
      const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
      const lines: string[] = [];

      segments.forEach(segment => {
        const text = segment.querySelector('.segment-text')?.textContent?.trim();
        if (text) lines.push(text);
      });

      return lines.join('\n');
    });

    return transcript || null;

  } catch (error) {
    console.error('Failed to extract transcript:', error);
    return null;
  } finally {
    await stagehand.close();
  }
}
```

---

## Data Models

### Supabase Schema

```sql
-- YouTube channels
CREATE TABLE youtube_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  custom_url VARCHAR(100),
  subscriber_count BIGINT,
  video_count INTEGER,
  view_count BIGINT,
  published_at TIMESTAMP WITH TIME ZONE,
  thumbnail_url VARCHAR(500),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- YouTube videos
CREATE TABLE youtube_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id VARCHAR(20) UNIQUE NOT NULL,
  channel_id UUID REFERENCES youtube_channels(id),
  title TEXT NOT NULL,
  description TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration VARCHAR(20),
  view_count BIGINT DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_live_stream BOOLEAN DEFAULT false,
  tags TEXT[],
  thumbnail_url VARCHAR(500),
  transcript TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_videos_channel ON youtube_videos(channel_id);
CREATE INDEX idx_videos_published ON youtube_videos(published_at DESC);

-- YouTube comments
CREATE TABLE youtube_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id VARCHAR(100) UNIQUE NOT NULL,
  video_id UUID REFERENCES youtube_videos(id),
  parent_comment_id UUID REFERENCES youtube_comments(id),
  author VARCHAR(255) NOT NULL,
  author_channel_id VARCHAR(50),
  text TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  is_reply BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comments_video ON youtube_comments(video_id);
CREATE INDEX idx_comments_published ON youtube_comments(published_at DESC);
```

---

## Example: Monitor Rijksoverheid

```typescript
// examples/monitor-rijksoverheid.ts
import { YouTubeAPI } from '../src/platforms/youtube/api';
import { getVideoTranscript } from '../src/platforms/youtube/transcript';

async function monitorRijksoverheid() {
  const youtube = new YouTubeAPI(process.env.YOUTUBE_API_KEY!);

  // 1. Get channel ID from custom URL
  const channelId = 'UCmdj3kCb2Gtu4mQHT8Bf6_w'; // Rijksoverheid

  // 2. Get recent videos
  const videos = await youtube.getChannelVideos(
    channelId,
    50,
    '2025-10-01T00:00:00Z'
  );

  console.log(`Found ${videos.length} videos`);

  // 3. Get details for each video
  for (const video of videos) {
    console.log(`\nProcessing: ${video.title}`);

    // Get full details
    const details = await youtube.getVideoDetails(video.id);
    console.log(`  Views: ${details.viewCount.toLocaleString()}`);
    console.log(`  Comments: ${details.commentCount}`);

    // Get comments
    if (details.commentCount > 0) {
      const comments = await youtube.getVideoComments(video.id, 100);
      console.log(`  Extracted ${comments.length} comments`);

      // Sentiment analysis could go here
    }

    // Get transcript
    const transcript = await getVideoTranscript(video.id);
    if (transcript) {
      console.log(`  Transcript: ${transcript.substring(0, 100)}...`);
    }

    // Store in database
    await storeVideoData(details, comments, transcript);

    // Rate limiting (quota management)
    await sleep(1000);
  }
}
```

---

## Quota Management

YouTube API has strict quota limits:

| Operation | Quota Cost | Example |
|-----------|------------|---------|
| **channels.list** | 1 unit | Get channel info |
| **playlistItems.list** | 1 unit | List videos |
| **videos.list** | 1 unit | Video details |
| **commentThreads.list** | 1 unit | Get comments |
| **Daily Limit** | 10,000 units | ~10,000 operations/day |

### Optimization Strategies

```typescript
class QuotaManager {
  private usedQuota = 0;
  private dailyLimit = 10000;

  async executeWithQuota<T>(
    operation: () => Promise<T>,
    cost: number
  ): Promise<T> {
    if (this.usedQuota + cost > this.dailyLimit) {
      throw new Error('Daily quota exceeded');
    }

    const result = await operation();
    this.usedQuota += cost;

    return result;
  }

  getRemainingQuota(): number {
    return this.dailyLimit - this.usedQuota;
  }
}

// Usage
const quotaManager = new QuotaManager();

const videos = await quotaManager.executeWithQuota(
  () => youtube.getChannelVideos(channelId),
  1  // costs 1 quota unit
);
```

---

## Use Cases

### 1. Political Speech Archive

Monitor government channels and archive all speeches:

```typescript
const governmentChannels = [
  { id: 'UCxxx', name: 'Rijksoverheid' },
  { id: 'UCyyy', name: 'Tweede Kamer' },
  { id: 'UCzzz', name: 'Eerste Kamer' }
];

for (const channel of governmentChannels) {
  const videos = await youtube.getChannelVideos(channel.id, 100);

  for (const video of videos) {
    // Get transcript
    const transcript = await getVideoTranscript(video.id);

    // Store for search/analysis
    await database.storeTranscript({
      source: 'youtube',
      channelName: channel.name,
      videoTitle: video.title,
      publishedAt: video.publishedAt,
      transcript
    });
  }
}
```

### 2. Public Opinion Analysis

Analyze comments on political videos:

```typescript
async function analyzePublicOpinion(videoId: string) {
  const comments = await youtube.getVideoComments(videoId, 1000);

  // Sentiment analysis
  const sentiments = comments.map(c => analyzeSentiment(c.text));
  const avgSentiment = sentiments.reduce((a, b) => a + b, 0) / sentiments.length;

  // Topic extraction
  const topics = extractTopics(comments.map(c => c.text));

  // Most discussed concerns
  const concerns = comments
    .filter(c => c.text.includes('probleem') || c.text.includes('zorgen'))
    .slice(0, 10);

  return {
    totalComments: comments.length,
    avgSentiment,
    topics,
    topConcerns: concerns
  };
}
```

### 3. Live Stream Monitoring

Monitor live streams (e.g., parliamentary sessions):

```typescript
async function monitorLiveStream(videoId: string) {
  const details = await youtube.getVideoDetails(videoId);

  if (!details.isLiveStream) {
    throw new Error('Not a live stream');
  }

  // Poll for new comments every 30 seconds
  setInterval(async () => {
    const comments = await youtube.getVideoComments(videoId, 20);

    // Process new comments
    for (const comment of comments) {
      await processLiveComment(comment);
    }
  }, 30000);
}
```

---

## Related Documentation

- [X/Twitter Extension](./twitter-x.md)
- [Facebook Extension](./facebook.md)
- [Instagram Extension](./instagram.md)
- [Generic Scraping](./generic-scraping.md)

---

[← Back to Documentation Index](../README.md)
