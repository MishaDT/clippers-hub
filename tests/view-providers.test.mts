import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeVideoId } from "../lib/view-providers.ts";

const videoId = "dQw4w9WgXcQ";

test("parses supported YouTube video URLs", () => {
  const urls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://youtube.com/shorts/${videoId}?feature=share`,
    `https://youtu.be/${videoId}`,
    `https://m.youtube.com/live/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`
  ];

  for (const url of urls) assert.equal(parseYouTubeVideoId(url), videoId);
});

test("rejects malformed URLs and lookalike domains", () => {
  const urls = [
    "not-a-url",
    `https://youtube.com.example.org/watch?v=${videoId}`,
    `https://notyoutube.com/watch?v=${videoId}`,
    "https://youtube.com/shorts/invalid$id"
  ];

  for (const url of urls) assert.equal(parseYouTubeVideoId(url), null);
});
