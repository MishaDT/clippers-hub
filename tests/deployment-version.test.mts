import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeploymentVersion } from "../lib/deployment-version.ts";

test("deployment version prefers the git commit", () => {
  assert.equal(resolveDeploymentVersion({
    VERCEL_GIT_COMMIT_SHA: "abc123",
    VERCEL_DEPLOYMENT_ID: "deployment-fallback"
  }), "abc123");
});

test("deployment version has stable fallbacks", () => {
  assert.equal(resolveDeploymentVersion({ VERCEL_DEPLOYMENT_ID: "deployment-42" }), "deployment-42");
  assert.equal(resolveDeploymentVersion({}), "local");
});
