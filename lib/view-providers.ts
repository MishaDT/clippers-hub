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

export const youtubeProvider: ViewProvider = {
  platform: "YOUTUBE",
  parsePostId(url) {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] || null;
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    const shorts = parsed.pathname.match(/\/shorts\/([^/?#]+)/);
    return shorts?.[1] || null;
  },
  async fetchSnapshot(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse YouTube video id");
    const key = requireEnv("YOUTUBE_DATA_API_KEY");
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${postId}&key=${key}`);
    if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);
    const data = await response.json();
    const stats = data.items?.[0]?.statistics || {};
    return {
      platform: "YOUTUBE",
      postId,
      views: readNumber(stats.viewCount),
      likes: readNumber(stats.likeCount),
      comments: readNumber(stats.commentCount),
      fetchedAt: new Date(),
      raw: data
    };
  },
  async fetchMeta(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse YouTube video id");
    const key = requireEnv("YOUTUBE_DATA_API_KEY");
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${postId}&key=${key}`);
    if (!response.ok) throw new Error(`YouTube API failed: ${response.status}`);
    const data = await response.json();
    const snippet = data.items?.[0]?.snippet || {};
    return {
      platform: "YOUTUBE",
      postId,
      title: String(snippet.title || ""),
      description: String(snippet.description || ""),
      channelId: snippet.channelId ? String(snippet.channelId) : undefined,
      channelTitle: snippet.channelTitle ? String(snippet.channelTitle) : undefined,
      raw: data
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
    const token = requireEnv("VK_SERVICE_TOKEN");
    const response = await fetch(`https://api.vk.com/method/video.get?v=5.199&videos=${postId}&access_token=${token}`);
    if (!response.ok) throw new Error(`VK API failed: ${response.status}`);
    const data = await response.json();
    const video = data.response?.items?.[0] || {};
    return {
      platform: "VK",
      postId,
      views: readNumber(video.views),
      likes: readNumber(video.likes?.count),
      comments: readNumber(video.comments),
      fetchedAt: new Date(),
      raw: data
    };
  },
  async fetchMeta(postUrl) {
    const postId = this.parsePostId(postUrl);
    if (!postId) throw new Error("Cannot parse VK video id");
    const token = requireEnv("VK_SERVICE_TOKEN");
    const response = await fetch(`https://api.vk.com/method/video.get?v=5.199&videos=${postId}&access_token=${token}`);
    if (!response.ok) throw new Error(`VK API failed: ${response.status}`);
    const data = await response.json();
    const video = data.response?.items?.[0] || {};
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
