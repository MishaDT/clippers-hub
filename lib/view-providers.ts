import { readTextWithLimit } from "./request-json.ts";

export type ViewPlatform = "YOUTUBE" | "VK" | "TIKTOK" | "INSTAGRAM";

export type ViewSnapshot = {
  platform: ViewPlatform;
  postId: string;
  views: number;
  likes?: number;
  comments?: number;
  fetchedAt: Date;
  raw?: unknown;
};

export type ViewMeta = {
  platform: ViewPlatform;
  postId: string;
  title: string;
  description: string;
  channelId?: string;
  channelTitle?: string;
  raw?: unknown;
};

export type ViewProvider = {
  platform: ViewPlatform;
  parsePostId(url: string): string | null;
  fetchSnapshot(postUrl: string): Promise<ViewSnapshot>;
  /** Public title/description used to prove the clip carries the campaign tracking code. */
  fetchMeta?(postUrl: string): Promise<ViewMeta>;
};

function readNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function readProviderJson<T>(response: Response): Promise<T> {
  return JSON.parse(await readTextWithLimit(response, 1_000_000)) as T;
}

type YouTubeVideo = {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    channelId?: string;
    channelTitle?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
};

const youtubeCache = new Map<string, { expiresAt: number; request: Promise<YouTubeVideo> }>();

async function fetchVkVideo(postId: string) {
  const body = new URLSearchParams({
    v: "5.199",
    videos: postId,
    access_token: requireEnv("VK_SERVICE_TOKEN")
  });
  // Keep the service token out of request URLs, proxy logs and exception messages.
  const response = await fetch("https://api.vk.com/method/video.get", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`VK API failed: ${response.status}`);
  const data = await readProviderJson<{
    response?: { items?: Array<Record<string, unknown>> };
    error?: { error_code?: number };
  }>(response);
  if (data.error) throw new Error(`VK API error: ${Number(data.error.error_code) || 0}`);
  return { data, video: data.response?.items?.[0] || {} };
}

export function parseYouTubeVideoId(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;

  if (host === "youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0] || null;
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    candidate =
      parsed.searchParams.get("v") ||
      parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ||
      null;
  }

  return candidate && /^[a-zA-Z0-9_-]{6,20}$/.test(candidate) ? candidate : null;
}

async function fetchYouTubeVideo(postId: string) {
  const cached = youtubeCache.get(postId);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const request = (async () => {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(postId)}`,
      {
        headers: { "X-Goog-Api-Key": requireEnv("YOUTUBE_DATA_API_KEY") },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);

    const data = await readProviderJson<{ items?: YouTubeVideo[] }>(response);
    const video = data.items?.[0] as YouTubeVideo | undefined;
    if (!video) throw new Error("YouTube video is unavailable or private");
    return video;
  })();

  youtubeCache.set(postId, { expiresAt: Date.now() + 30_000, request });
  try {
    return await request;
  } catch (error) {
    youtubeCache.delete(postId);
    throw error;
  }
}

export const youtubeProvider: ViewProvider = {
  platform: "YOUTUBE",
  parsePostId(url) {
    return parseYouTubeVideoId(url);
  },
  async fetchSnapshot(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse YouTube video id");
    const video = await fetchYouTubeVideo(postId);
    const stats = video.statistics || {};
    return {
      platform: "YOUTUBE",
      postId,
      views: readNumber(stats.viewCount),
      likes: readNumber(stats.likeCount),
      comments: readNumber(stats.commentCount),
      fetchedAt: new Date(),
      raw: video
    };
  },
  async fetchMeta(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse YouTube video id");
    const video = await fetchYouTubeVideo(postId);
    const snippet = video.snippet || {};
    return {
      platform: "YOUTUBE",
      postId,
      title: String(snippet.title || ""),
      description: String(snippet.description || ""),
      channelId: snippet.channelId ? String(snippet.channelId) : undefined,
      channelTitle: snippet.channelTitle ? String(snippet.channelTitle) : undefined,
      raw: video
    };
  }
};

export const vkProvider: ViewProvider = {
  platform: "VK",
  parsePostId(url) {
    const match = url.match(/video(-?\d+)_(\d+)/);
    return match ? `${match[1]}_${match[2]}` : null;
  },
  async fetchSnapshot(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse VK video id");
    const { data, video } = await fetchVkVideo(postId);
    return {
      platform: "VK",
      postId,
      views: readNumber(video.views),
      likes: readNumber((video.likes as { count?: unknown } | undefined)?.count),
      comments: readNumber(video.comments),
      fetchedAt: new Date(),
      raw: data
    };
  },
  async fetchMeta(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse VK video id");
    const { data, video } = await fetchVkVideo(postId);
    return {
      platform: "VK",
      postId,
      title: String(video.title || ""),
      description: String(video.description || ""),
      channelId: video.owner_id != null ? String(video.owner_id) : undefined,
      channelTitle: video.owner_id != null ? `id${video.owner_id}` : undefined,
      raw: data
    };
  }
};

export const tiktokProvider: ViewProvider = {
  platform: "TIKTOK",
  parsePostId(url) {
    const match = url.match(/\/video\/(\d+)/);
    return match?.[1] || null;
  },
  async fetchSnapshot(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse TikTok video id");
    throw new Error("TikTok Display API requires OAuth user token and video.list scope before direct metrics sync");
  }
};

export const instagramProvider: ViewProvider = {
  platform: "INSTAGRAM",
  parsePostId(url) {
    const match = url.match(/\/(?:reel|p)\/([^/?#]+)/);
    return match?.[1] || null;
  },
  async fetchSnapshot(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse Instagram media shortcode");
    throw new Error("Instagram insights require connected creator/professional account and media id mapping");
  }
};

export const viewProviders: Record<ViewPlatform, ViewProvider> = {
  YOUTUBE: youtubeProvider,
  VK: vkProvider,
  TIKTOK: tiktokProvider,
  INSTAGRAM: instagramProvider
};
