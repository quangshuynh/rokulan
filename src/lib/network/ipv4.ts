import { RokuError } from "@/types/roku";

const IPV4_SEGMENT = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_PATTERN = new RegExp(`^${IPV4_SEGMENT}(?:\\.${IPV4_SEGMENT}){3}$`);

export function isValidIPv4(value: string): boolean {
  return IPV4_PATTERN.test(value.trim());
}

export function isPrivateOrLocalIPv4(value: string): boolean {
  if (!isValidIPv4(value)) {
    return false;
  }

  const [a, b] = value.split(".").map(Number);

  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 127
  );
}

export function normalizePrivateIPv4(value: string): string {
  const trimmed = value.trim();

  if (!isValidIPv4(trimmed) || !isPrivateOrLocalIPv4(trimmed)) {
    throw new RokuError(
      "invalid_ip",
      "Enter a valid private/local IPv4 address (for example 192.168.1.12).",
    );
  }

  return trimmed;
}
