# Handover: Pinboard (`pinboard-botchain`)

## Summary
- **Slug / Project**: `pinboard` / 54 (Wave 4, Batch A)
- **Tagline**: Pin a notice with a deposit. Take it down to get it back.
- **Contract**: `Pinboard` in `contracts/src/Pinboard.sol`
- **Design Archetype**: AT · Corkboard (ground `#D98BA4`, ink `#2E0D18`, accent `#1D3557`)
- **Fonts**: Cabin (UI, headings) & Caveat (handwriting notes)

## Verification Gates & Results
- `forge test`: 16 tests passed; 1 invariant test passed (256 runs, 32,768 calls, 0 reverts).
- `npm test`: 10 test suites passed (48 tests), including hook dependency lint and contract limits agreement.
- `npm run test:integration`: 2 test suites passed (5 tests) on Anvil (port 8654), exercising full lifecycle: pin -> read log -> evm_increaseTime -> sweep -> dual withdraw.
- `mutation-check.py pinboard`: 20/25 mutants killed. 5 survivors explained (pagination count/offset boundary clamps and strict inequality equivalents in read-only helpers).
- `check-honesty.py pinboard`: 0 findings.
- `check-ui-contract.py pinboard`: ok.
- `check-tokens.py pinboard`: 0 undefined tokens.
- `check-distinct.py pinboard`: 54 projects compared; 0 pair/file problem(s).
- `npm run build`: Static and dynamic routes compiled cleanly.

## Contrast Metrics (WCAG)
- Ink on Ground: 6.89:1 (passes AA)
- Ink on Surface: 16.46:1 (passes AAA)
- Muted on Surface: 11.17:1 (passes AAA)
- Accent Ink on Accent: 12.36:1 (passes AAA)
- Menu Text on Menu BG: 17.69:1 (passes AAA)
- Menu Muted on Menu BG: 4.74:1 (passes AA)

## Routes Verified
- `/`: The Corkboard, topic pin filter bar, stable note rotations, sweep buttons on expired notes, accessible table equivalent.
- `/pin`: Notice posting form with live UTF-8 byte counter (capped at 200), duration, deposit calculation, and transparent sweeper terms preview.
- `/notice/[id]`: Shareable notice card with full metadata, author renewal/take down controls, and sweeper actions.
- `/me`: Aggregated overview of user's pinned notices, deposit recovery actions, and pending bounty withdrawal.
