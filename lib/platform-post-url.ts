export type SupportedMediaPlatform = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "VK" | "TWITCH";

function cleanHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

export function extractSupportedPlatformPostId(postUrl: string, platform: SupportedMediaPlatform): string | null {
  let url: URL;
  try {
    url = new URL(postUrl);
  } catch {
    return null;
  }

  const host = cleanHost(url);
  const path = url.pathname;

  if (platform === "YOUTUBE") {
    const candidate = host === "youtu.be"
      ? path.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || path.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1];
    return candidate && /^[a-zA-Z0-9_-]{6,20}$/.test(candidate) ? candidate : null;
  }

  if (platform === "VK") {
    const match = `${path}${url.search}`.match(/(?:video|clip)(-?\d+)_(\d+)/i);
    return match ? `${match[1]}_${match[2]}` : null;
  }

  if (platform === "TIKTOK") {
    const direct = path.match(/\/(?:@[^/]+\/)?video\/(\d+)/i)?.[1];
    if (direct) return direct;
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
      const shortCode = path.split("/").filter(Boolean)[0];
      return shortCode && /^[a-zA-Z0-9_-]{4,80}$/.test(shortCode) ? `short_${shortCode}` : null;
    }
    return null;
  }

  if (platform === "INSTAGRAM") {
    const shortcode = path.match(/^\/(?:reel|reels|p|tv)\/([^/?#]+)/i)?.[1];
    return shortcode && /^[a-zA-Z0-9_-]{4,80}$/.test(shortcode) ? shortcode : null;
  }

  const twitchVideo = path.match(/^\/videos\/(\d+)/i)?.[1];
  if (twitchVideo) return twitchVideo;
  const twitchClip = host === "clips.twitch.tv"
    ? path.split("/").filter(Boolean)[0]
    : path.match(/^\/[^/]+\/clip\/([^/?#]+)/i)?.[1];
  return twitchClip && /^[a-zA-Z0-9_-]{4,100}$/.test(twitchClip) ? twitchClip : null;
}
