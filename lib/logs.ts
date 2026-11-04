import { parseAbiItem } from "viem";

export const PINNED_EVENT = parseAbiItem(
  "event Pinned(uint256 indexed id, address indexed author, uint8 indexed topic, uint64 expiresAt, uint128 deposit, string text)"
);

export const RENEWED_EVENT = parseAbiItem(
  "event Renewed(uint256 indexed id, uint64 expiresAt)"
);

export const UNPINNED_EVENT = parseAbiItem(
  "event Unpinned(uint256 indexed id, address indexed author, uint256 refunded)"
);

export const SWEPT_EVENT = parseAbiItem(
  "event Swept(uint256 indexed id, address indexed by, uint256 bounty, uint256 returned)"
);

export const WITHDRAWN_EVENT = parseAbiItem(
  "event Withdrawn(address indexed to, uint256 amount)"
);
