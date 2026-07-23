# Approved visual baseline

These seven PNGs were copied byte-for-byte on 2026-07-12 from the read-only
`dungeon-2.0/audit-2026-07-11/` graphics audit. They are reference images for
the pre-overhaul presentation and must not be regenerated during implementation.

| File | Reference context | PNG dimensions |
| --- | --- | --- |
| `01-boot.png` | Desktop boot screen | 1280×720 |
| `02-main-menu.png` | Desktop main menu | 1265×712 |
| `03-gameplay-depth-0.png` | Desktop gameplay, depth 0 | 1265×712 |
| `04-gameplay-shield.png` | Desktop gameplay with shield | 1265×712 |
| `05-forge-reward.png` | Desktop forge reward | 1280×720 |
| `06-final-boss.png` | Desktop final boss | 1716×951 |
| `07-mobile-boss.png` | Mobile final boss, 390×844 viewport | 390×844 |

The audit identifies screenshots 01–06 as desktop references and explicitly
records the mobile viewport as 390×844. Exact desktop browser viewport metadata
cannot be proven from the audit files, so the PNG pixel dimensions above must
not be treated as viewport dimensions. The audited gameplay canvas was logically
144×144 pixels (9×9 tiles at 16 pixels per tile) and scaled up for display.
