import assert from "node:assert/strict";
import test from "node:test";
import { extractSupportedPlatformPostId } from "../lib/platform-post-url.ts";

test("extracts supported publication ids", () => {
  assert.equal(extractSupportedPlatformPostId("https://youtube.com/shorts/AbCdEf12345", "YOUTUBE"), "AbCdEf12345");
  assert.equal(extractSupportedPlatformPostId("https://youtu.be/AbCdEf12345", "YOUTUBE"), "AbCdEf12345");
  assert.equal(extractSupportedPlatformPostId("https://vk.com/video-123_456", "VK"), "-123_456");
  assert.equal(extractSupportedPlatformPostId("https://www.tiktok.com/@creator/video/7451234567890", "TIKTOK"), "7451234567890");
  assert.equal(extractSupportedPlatformPostId("https://instagram.com/reel/ABC_def12/", "INSTAGRAM"), "ABC_def12");
});

test("rejects platform home, profile and malformed publication urls", () => {
  assert.equal(extractSupportedPlatformPostId("https://youtube.com/", "YOUTUBE"), null);
  assert.equal(extractSupportedPlatformPostId("https://youtube.com/@creator", "YOUTUBE"), null);
  assert.equal(extractSupportedPlatformPostId("https://tiktok.com/@creator", "TIKTOK"), null);
  assert.equal(extractSupportedPlatformPostId("https://instagram.com/", "INSTAGRAM"), null);
  assert.equal(extractSupportedPlatformPostId("https://vk.com/feed", "VK"), null);
});
