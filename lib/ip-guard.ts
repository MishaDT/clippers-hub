// Pure IP classification for SSRF defence. Kept free of "server-only" so it can be unit
// tested directly. Used by the image/metadata proxy to refuse private/internal targets.

export function ipv4IsPrivate(ip: string) {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → unsafe
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;          // 0/8 (this host), 10/8, loopback 127/8
  if (a === 169 && b === 254) return true;                    // link-local 169.254/16 incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16/12
  if (a === 192 && b === 168) return true;                    // 192.168/16
  if (a === 192 && b === 0) return true;                      // 192.0.0/24 protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true;          // CGNAT 100.64/10
  if (a >= 224) return true;                                  // multicast/reserved 224+ / 240+
  return false;
}

export function isPrivateAddress(address: string) {
  const addr = address.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/%.*$/, "");
  if (!addr) return true;
  // IPv4-mapped/compatible IPv6 in dotted form: ::ffff:127.0.0.1 / ::127.0.0.1
  const dotted = /^::(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr);
  if (dotted) return ipv4IsPrivate(dotted[1]);
  // IPv4-mapped IPv6 in hex form: ::ffff:7f00:0001
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(addr);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return ipv4IsPrivate(`${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`);
  }
  // Dotted IPv4 (also catches malformed multi-dot strings → unsafe via ipv4IsPrivate).
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(addr)) return ipv4IsPrivate(addr);
  if (addr === "::" || addr === "::1" || addr === "0:0:0:0:0:0:0:1") return true; // unspecified / loopback
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true;                // unique-local fc00::/7
  if (/^fe[89ab]/.test(addr)) return true;                                        // link-local fe80::/10
  return false;
}
