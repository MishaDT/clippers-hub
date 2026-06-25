import { viewProviders, type ViewPlatform } from "@/lib/view-providers";

/**
 * Video-ownership antifraud.
 *
 * A clipper can paste ANY public video URL into a submission — including someone
 * else's viral clip — and try to farm its views/payout. To prevent that we make
 * each submission carry a unique `trackingCode` that the clipper must place in
 * the published video's description. Before a submission is allowed to settle we
 * re-fetch the video's title+description from the platform API and confirm the
 * code is actually there. Only the real uploader can edit that description, so a
 * present code proves the clip belongs to this clipper for this campaign.
 */

export type OwnershipResult = {
  platform: string;
  /** Does the platform expose public title/description we can verify? */
  verifiable: boolean;
  /** Was the tracking code found in the title/description? */
  matched: boolean;
  /** Machine reason: code_found | code_missing | fetch_failed:* | platform_no_public_metadata */
  reason: string;
  evidence?: { title?: string; channelTitle?: string; snippet?: string };
};

// Platforms whose public metadata we can read without a per-user OAuth token.
const VERIFIABLE = new Set<ViewPlatform>(["YOUTUBE", "VK"]);

function isVerifiable(platform: string): platform is ViewPlatform {
  return VERIFIABLE.has(platform as ViewPlatform);
}

// Compare loosely: ignore case and whitespace so "ch_cpv_12_misha_345" still
// matches even if the platform reformats the description.
function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

export function platformIsVerifiable(platform: string) {
  return isVerifiable(platform);
}

export async function checkOwnership(opts: {
  platform: string;
  postUrl: string;
  trackingCode: string;
}): Promise<OwnershipResult> {
  const { platform, postUrl, trackingCode } = opts;

  if (!isVerifiable(platform)) {
    // TikTok / Instagram give no public metadata without a connected creator
    // token — these stay on the manual-review path (see syncViews).
    return { platform, verifiable: false, matched: false, reason: "platform_no_public_metadata" };
  }

  const provider = viewProviders[platform];
  if (!provider.fetchMeta) {
    return { platform, verifiable: false, matched: false, reason: "no_meta_fetcher" };
  }

  let meta;
  try {
    meta = await provider.fetchMeta(postUrl);
  } catch (error) {
    // Missing API key, quota, network, deleted/private video — transient, don't
    // penalize the clipper; the next sync retries.
    return {
      platform,
      verifiable: true,
      matched: false,
      reason: `fetch_failed:${error instanceof Error ? error.message : "unknown"}`
    };
  }

  const haystack = normalize(`${meta.title} ${meta.description}`);
  const needle = normalize(trackingCode);
  const matched = needle.length >= 4 && haystack.includes(needle);

  return {
    platform,
    verifiable: true,
    matched,
    reason: matched ? "code_found" : "code_missing",
    evidence: {
      title: meta.title.slice(0, 140),
      channelTitle: meta.channelTitle,
      snippet: meta.description.slice(0, 240)
    }
  };
}
