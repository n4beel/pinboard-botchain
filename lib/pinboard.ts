export const PINBOARD_CONSTANTS = {
  MAX_TEXT_BYTES: 200,
  TOPICS: 8,
  MIN_TTL: 3600n, // 1 hours
  MAX_TTL: 2592000n, // 30 days
  MIN_DEPOSIT: 10000000000000000n, // 0.01 ether
  MAX_DEPOSIT: 100000000000000000000n, // 100 ether
  SWEEP_BPS: 2000n, // 20%
  MAX_PAGE: 50,
  MAX_SWEEP_SCAN: 200,
} as const;

export const TOPIC_NAMES = [
  "For sale",
  "Wanted",
  "Event",
  "Lost & found",
  "Offer",
  "Notice",
  "Jobs",
  "Other",
] as const;

export type TopicIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface NoticeInfo {
  id: bigint;
  author: `0x${string}`;
  expiresAt: bigint;
  deposit: bigint;
  postedBlock: number;
  topic: number;
  open: boolean;
  text?: string;
}

/**
 * UTF-8 byte length calculation mirroring EVM bytes(text).length
 */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Calculate sweeper bounty (20% of deposit)
 */
export function bounty(deposit: bigint): bigint {
  return (deposit * PINBOARD_CONSTANTS.SWEEP_BPS) / 10000n;
}

/**
 * Calculate author returned portion after sweep (80% of deposit)
 */
export function returned(deposit: bigint): bigint {
  return deposit - bounty(deposit);
}

/**
 * Human-readable time left until expiry or expired status
 */
export function timeLeft(expiresAt: bigint, nowSecs: bigint): { text: string; expired: boolean; secsLeft: bigint } {
  if (nowSecs >= expiresAt) {
    const elapsed = nowSecs - expiresAt;
    const mins = Number(elapsed / 60n);
    const hrs = Number(elapsed / 3600n);
    const days = Number(elapsed / 86400n);
    let str = "Expired";
    if (days > 0) str = `Expired ${days}d ago`;
    else if (hrs > 0) str = `Expired ${hrs}h ago`;
    else if (mins > 0) str = `Expired ${mins}m ago`;
    return { text: str, expired: true, secsLeft: 0n };
  }

  const rem = expiresAt - nowSecs;
  const mins = Number(rem / 60n);
  const hrs = Number(rem / 3600n);
  const days = Number(rem / 86400n);

  let text = `${mins}m left`;
  if (days > 0) text = `${days}d ${hrs % 24}h left`;
  else if (hrs > 0) text = `${hrs}h ${mins % 60}m left`;

  return { text, expired: false, secsLeft: rem };
}

/**
 * Stable slight rotation angle in degrees for Corkboard archetype note pinning
 * Bounded between -2.5 and +2.5 degrees based on notice id
 */
export function noteAngle(id: bigint | number): number {
  const n = Number(id);
  const angles = [-2.1, 1.4, -1.2, 2.3, -0.8, 1.9, -2.4, 0.9, -1.7, 2.0];
  return angles[Math.abs(n) % angles.length];
}
