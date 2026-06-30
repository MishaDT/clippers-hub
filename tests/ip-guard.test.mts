import assert from "node:assert/strict";
import test from "node:test";
import { ipv4IsPrivate, isPrivateAddress } from "../lib/ip-guard.ts";

test("public IPv4 addresses are allowed", () => {
  for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "151.101.1.69"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("private and special-use IPv4 ranges are blocked", () => {
  for (const ip of [
    "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "100.64.0.1", "0.0.0.0", "192.0.0.1", "224.0.0.1", "255.255.255.255"
  ]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
});

test("172.x outside 16-31 stays public", () => {
  assert.equal(isPrivateAddress("172.15.0.1"), false);
  assert.equal(isPrivateAddress("172.32.0.1"), false);
});

test("IPv4-mapped IPv6 (dotted and hex) is unwrapped and classified", () => {
  assert.equal(isPrivateAddress("::ffff:127.0.0.1"), true);
  assert.equal(isPrivateAddress("::ffff:169.254.169.254"), true);
  assert.equal(isPrivateAddress("::127.0.0.1"), true);
  assert.equal(isPrivateAddress("::ffff:7f00:0001"), true); // 127.0.0.1 in hex
  assert.equal(isPrivateAddress("::ffff:a9fe:a9fe"), true); // 169.254.169.254 in hex
  assert.equal(isPrivateAddress("::ffff:0808:0808"), false); // 8.8.8.8 in hex -> public
});

test("IPv6 loopback/unspecified/link-local/ULA blocked, global allowed", () => {
  for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false); // public DNS
});

test("brackets and zone ids are stripped before classification", () => {
  assert.equal(isPrivateAddress("[::1]"), true);
  assert.equal(isPrivateAddress("fe80::1%eth0"), true);
});

test("malformed or empty input is treated as unsafe", () => {
  assert.equal(isPrivateAddress(""), true);
  assert.equal(ipv4IsPrivate("999.1.1.1"), true);
  assert.equal(ipv4IsPrivate("1.2.3"), true);
});
