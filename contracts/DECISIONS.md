# Pinboard — Design and Architecture Decisions

## 1. Why Text Lives in the Log (`Pinned` Event)
- **Gas Efficiency & Scalability**: Storing up to 200 bytes of arbitrary string text on-chain in contract storage (SSTORE) would make posting notices prohibitively expensive, especially for short-lived community announcements (1 hour to 30 days).
- **Log Permanence**: Emitting the text in the `Pinned` event indexes it permanently on-chain in the log history at `postedBlock`. The frontend retrieves the text via `publicClient.getLogs` using `fromBlock = toBlock = postedBlock`.
- **Fault-Tolerance**: If log text is temporarily unavailable or RPC log queries fail, the notice card gracefully displays "text unavailable" without throwing or halting UI rendering.

## 2. The 20% Sweeper Bounty (`SWEEP_BPS = 2000`)
- **Self-Cleaning Board**: Notices carry an expiration time (1h to 30d). To avoid zombie spam lingering forever on a board without an active admin/moderator, anyone can sweep an expired notice.
- **Incentive Alignment**: The sweeper receives 20% of the locked deposit as a bounty (`pending[msg.sender] += bounty`), and the author receives the remaining 80% (`pending[author] += returned`).
- **Free Taking Down**: If the author takes down their notice before it is swept (either before or after expiry), they receive a 100% full refund of their deposit.

## 3. Pull Payment Pattern for Sweeps and Withdrawals
- Sweeping credits both the sweeper and the notice author into `pending`.
- Neither party's execution relies on an arbitrary external ether transfer inside `sweep()`, eliminating denial-of-service risks caused by gas limits, revert bombs, or non-payable contracts.
- The `withdraw()` function is protected by a non-reentrant mutex and checks-effects-interactions.
