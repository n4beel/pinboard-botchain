# Pinboard

> Pin a notice with a deposit. Take it down to get it back.

Pinboard is a deposit-backed public notice board with an autonomous garbage-collection bounty mechanism. Anyone can pin a notice across 8 community categories by locking a refundable BOT deposit. When you take down your own notice, you get 100% of your deposit back. If an expired notice is left unattended, anyone can sweep it to earn a 20% bounty, with the remaining 80% credited back to the author.

## Features
- **Corkboard Archetype (AT)**: Visual corkboard with paper notes tilted at stable angles, topic-coded pins, and handwriting typography with accessible fallback lines.
- **Deposit-Backed Posting**: Deters spam without requiring centralized moderation or administrative censors.
- **Bounty Sweeping**: Autonomous clearing of expired notes incentivized by a 20% fee bounty.
- **Log-Stored Note Text**: Saves immense storage gas by logging the text at `postedBlock`, maintaining permanence while providing a resilient fallback.
- **Conservation of Funds**: Invariant `balance == Σ open deposits + Σ pending` verified by continuous fuzz and stateful invariant testing.

## Verification & Testing
- **Foundry**: 16 unit/fuzz tests + 1 stateful invariant test (`256 runs, 32,768 calls, 0 reverts`).
- **Mutation Testing**: 20/25 mutants killed; 5 survivors are pagination boundary clamps explained in `contracts/DECISIONS.md`.
- **Vitest**: 10 unit test suites passed (48 tests), including hook dependency lint and contract limits agreement.
- **Integration**: Anvil test suite on port 8654 verifying pin -> log reading -> time travel -> sweep -> dual withdrawal.
- **Verification Gates**: All four checks (`check-ui-contract`, `check-tokens`, `check-distinct`, `check-honesty`) exit 0.

## Local Stack
Run the local stack seeder to launch anvil and seed 12 notices across all topics:
```bash
node scripts/local-stack.mjs
```
Then start the dev server:
```bash
npm run dev
```
