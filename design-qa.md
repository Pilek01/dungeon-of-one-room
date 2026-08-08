**Source visual truth**

- `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\ux-audit-hd-v2\02-target-mockup.png`

**Implementation evidence**

- Stage 4 gameplay: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\hd-skill-cards-stage4\01-current-stage4.png`
- Skill tooltip focus: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\hd-skill-cards-stage4\02-tooltip-focus.png`
- Normalized comparison: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\hd-skill-cards-stage4\03-target-vs-current.png`
- Browser viewport: 1280 x 720 desktop. The 1680 x 945 source and implementation capture share a 16:9 ratio; the implementation was normalized to source size in the comparison image.
- State: deterministic HD combat with Rare Dash, Epic Shockwave and Legendary Shield.

**Full-view comparison evidence**

- All three skill cards remain visible inside the HD composition at the shipping-height breakpoint, without covering the playfield or side HUD.
- The card strip now spans the available center width and preserves separate silhouettes instead of reading as one black bar.

**Focused region comparison evidence**

- Rare, Epic and Legendary use the existing blue, purple and orange raster frames and real skill illustrations.
- The cards have deliberate transparent gaps, taller mockup-like proportions, larger art and a clearer rarity/status hierarchy.
- The opaque rectangular corners baked into the frame rasters are visually removed with tier-specific clipping while the ornamental frame and dark readable interior remain intact.
- The skill tooltip uses the same raster frame, typography and focus behavior as the left and right HUD tooltips.

**Findings**

- No actionable P0, P1 or P2 differences remain in Stage 4.
- Fonts and typography: rarity remains the dominant display label; hotkey, name, status and description retain distinct weights and do not overlap in the tested state.
- Spacing and layout rhythm: the cards no longer touch, use the available side space and keep equal widths.
- Colors and visual tokens: rarity colors remain limited to blue, purple and orange accents. Shared chrome stays neutral.
- Image quality and asset fidelity: all visible frames and skill icons are supplied raster assets; no placeholder iconography or generated CSS drawing is used.
- Copy and content: skill names, hotkeys, current state and tier-specific descriptions remain driven by gameplay state.

**Comparison history**

1. Earlier implementation: cards touched, were compressed vertically, and the opaque raster corners formed three obvious black rectangles.
2. Fix: expanded the strip, added 8-14 px responsive gaps, increased the card row to 124-148 px, rebalanced art/text and clipped only the unwanted outer raster corners.
3. Tooltip fix: replaced native `title` behavior with the shared HD tooltip on the whole card, including keyboard focus and multiline copy.
4. Post-fix evidence: `03-target-vs-current.png` shows three independent framed cards with clear rarity hierarchy; `02-tooltip-focus.png` proves the shared tooltip presentation.

**Primary interactions tested**

- Loaded the deterministic Rare/Epic/Legendary HD showcase.
- Focused the full Dash card and confirmed the custom tooltip title and tier details.
- Checked browser diagnostics: zero errors and warnings.
- Contract test verifies Base/Rare/Epic/Legendary class mapping, raster frame references, responsive spacing and tooltip binding.

**Follow-up polish**

- P3: a future dedicated neutral Base raster could replace the intentionally desaturated Rare frame, but this does not block the approved rarity set.

final result: passed

## Stage 5 — right rail and overlay consistency

- Final evidence: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\hd-stage5\02-options-right-rail-final.png`
- Right rail keeps Active Effects independently scrollable and guarantees a larger minimum Dungeon Log region.
- Options, Tutorial, merchant, nickname and confirmation surfaces share the HD menu-frame material, safe center bounds, typography and scrollbar treatment.
- In-run Options remains centered inside the room safe region while the frozen Player HUD, resources, skills and right rail retain their positions.
- The compact Options rows keep descriptions and the keyboard hint fully inside the ornamental frame at 1280 x 720.
- Contract coverage: `hd-overlay-consistency.test.js`, `hd-right-hud.test.js` and `hd-pause-menu.test.js` pass.
- Tutorial overflow follow-up: guide selection and guide content now use dedicated inner scroll regions; titles and close hints remain fixed inside the frame safe area. Evidence: `output\hd-stage5\03-tutorial-list-safe.png` and `output\hd-stage5\05-camp-guide-scroll-final.png`.

Stage 5 result: passed

### Stage 5 post-implementation audit

- Audit viewport: 1280 x 720, HD mode only.
- Right rail correction: Active Effects and Mutators now size to content; Dungeon Log receives the remaining height. Large effect stacks keep an independent bounded scroll region.
- Confirmation correction: all three overwrite-save choices remain visible together, including the default selected Cancel action.
- Options, tutorial selection and scrolled tutorial detail remain contained by the ornamental safe area.
- Evidence: `output\hd-stage5-audit\06-right-rail-final.png`, `02-options-final.png`, `03-tutorial-list-final.png`, `04-camp-guide-scrolled-final.png`, `07-overwrite-confirm-final.png`.
- Full audit: `output\hd-stage5-audit\audit.md`.

Stage 5 post-audit result: passed; no actionable P0, P1 or P2 findings remain.
## 2026-07-19 - Ember Sanctuary Camp redesign

**Source visual truth**

- `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\camp-ember-sanctuary\reference.png`
- Selected concept: first displayed ImageGen option, with the campfire sanctuary on the left and the preparation interface on the right.

**Implementation evidence**

- 2048 x 1152 Upgrades state: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\camp-ember-sanctuary\implementation\camp-shop.png`
- 1440 x 900 responsive state: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\camp-ember-sanctuary\implementation\camp-upgrades-1440x900.png`
- Full-view normalized comparison: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\camp-ember-sanctuary\comparison-final-full.jpg`
- Focused UI comparison: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\camp-ember-sanctuary\comparison-final-detail.jpg`
- State: deterministic Camp scenario, Upgrades active, Vitality selected. Scenario wallet/relic counts are dynamic and intentionally differ from the concept values.

**Full-view comparison evidence**

- The dedicated campfire and shrine artwork occupies the left environmental zone while all interactive preparation UI stays in the right zone.
- The generic oversized menu frame is removed. The interface fills the viewport without page overflow at both tested sizes.
- The content starts at x=656.8 in the 2048 capture and retains the selected concept's left-scene/right-interface hierarchy.

**Focused region comparison evidence**

- The active Upgrades tab uses quiet green while the selected Vitality row uses a separate gold focus treatment.
- Upgrade names, descriptions, levels, prices, shortage states, and raster icons remain readable without tooltips covering neighboring rows.
- Existing HD status/relic images supply every visible icon; the environment is a dedicated raster asset rather than CSS or placeholder art.

**Findings**

- No actionable P0, P1 or P2 differences remain.
- Fonts and typography: the final pass increases upgrade names and descriptions toward the reference scale while preserving two-level hierarchy and one-line scanning.
- Spacing and layout rhythm: four compact stats, four tabs, a two-column five-row ledger, one primary CTA, and one contextual control hint match the selected density.
- Colors and visual tokens: moss-green active state, warm-gold keyboard focus, ivory copy, red shortages, and amber camp light stay semantically distinct.
- Image quality and asset fidelity: the camp background has the correct 16:9 crop and clean negative space; 10/10 upgrade icons and all tab-specific icons loaded in headed QA.
- Copy and content: HD hints are contextual; Classic key copy remains available in the Classic path.
- Accessibility and behavior: exactly one keyboard focus is present, all four tabs are keyboard reachable, disabled rows remain legible, and no viewport scrolling appears.
- Responsive behavior: headed QA passed at 2048 x 1152 and 1440 x 900.
- Browser diagnostics: no page errors or non-resource console errors were recorded.

**Comparison history**

1. First implementation pass kept the right interface too narrow and shifted it too far right.
2. Layout fix changed the environmental column from 38vw to 28vw and reduced outer padding, matching the reference proportions.
3. Focused inspection found a Camp tooltip covering the adjacent upgrade column; Camp tooltips were removed because all required information is already visible in each row.
4. Typography was enlarged after the focused comparison showed smaller-than-reference item copy.
5. Headed navigation regression found ArrowDown from Elixirs selecting row 8 instead of the first right-column row 6. The spatial score's inverse-distance ratio term was capped; the final headed run confirms first-row transitions 1, 1, 6, 6 for Upgrades, Mutators, Elixirs, and Relics.

**Follow-up polish**

- P3: the production Start Next Run control is less ornamented than the concept illustration, but its hierarchy, dimensions, focus state, and interaction match the intended role.

final result: passed

## 2026-07-19 - Camp ornament and navigation follow-up

**Source and implementation evidence**

- Source visual truth: `output/product-design/camp-ember-sanctuary/reference.png`.
- Final 2048 x 1152 implementation: `output/product-design/camp-ember-sanctuary/implementation/camp-upgrades-final.png`.
- Full-view comparison: `output/product-design/camp-ember-sanctuary/comparison-polish-final.jpg`.
- Focused CTA comparison: `output/product-design/camp-ember-sanctuary/comparison-polish-cta.jpg`.

**Verified state**

- Viewports: 2048 x 1152 and 1440 x 900, deterministic `relic_exchange` Camp scenario, HD presentation forced after startup.
- State: Upgrades active, Vitality selected, all ten upgrade icons loaded.
- Primary interactions: all four tabs, ArrowDown from each tab, Vitality ArrowRight to Potion Strength, and Potion Strength ArrowLeft back to Vitality.

**Findings and comparison history**

- [P2] The production ledger and Start Next Run control were visibly plainer than the selected concept.
- Fix: reused the existing raster `board-frame.png`, `section-plaque.png`, and `panel-texture.png` as nine-slice ornamental framing and material texture; added the existing shrine raster icon to the CTA.
- Post-fix evidence: the ledger has a continuous gothic frame and textured cards; the CTA is wider, taller, more legible, and proportioned toward the source.
- [P1] Horizontal movement from Vitality could select the Mutators tab; the first follow-up fix exposed an inverse-direction edge case.
- Root cause: geometry-only navigation did not encode Camp row pairs, and `Number(null)` allowed a tab without grid coordinates to impersonate row 0 / column 0.
- Fix: every Camp row now carries explicit grid coordinates; horizontal movement resolves its same-row neighbor first and rejects controls without both coordinates.
- Post-fix evidence: headed QA records the exact transition `1 -> 6 -> 1` with exactly one selected control.

**Required fidelity surfaces**

- Fonts and typography: larger CTA label now matches the reference hierarchy while item copy remains unchanged and readable.
- Spacing and layout rhythm: larger CTA and ornamental table border fit both tested viewports without crowding or page overflow.
- Colors and visual tokens: moss green, warm gold, aged iron, and charcoal remain consistent with the existing HD Gothic assets.
- Image quality and asset fidelity: all added ornamentation uses existing raster assets with nine-slice framing; no CSS-drawn replacement art was introduced.
- Copy and content: Start Next Run, prices, levels, shortages, and keyboard guide remain intact.

- Browser diagnostics: no page errors or non-resource console errors.
- Responsive result: passed at 2048 x 1152 and 1440 x 900.

final result: passed

## 2026-07-19 - Forge Anvil Sanctuary redesign

**Source visual truth**

- `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\forge-anvil-sanctuary\reference.png`
- Selected concept: first displayed Forge option, with the furnace and anvil environment on the left and the action interface on the right.

**Implementation evidence**

- Final mode state: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\forge-anvil-sanctuary\implementation\forge-mode-final.png`
- Transmute sacrifice state: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\forge-anvil-sanctuary\implementation\forge-transmute-select.png`
- Full-view normalized comparison: `C:\Users\Kamil\Downloads\claudeodeallowed\Dungeon\dungeon-2.0\output\product-design\forge-anvil-sanctuary\implementation\comparison-final.png`
- Browser viewport: 1440 x 900 desktop.
- State: deterministic Forge scenario, Temper initially selected; separate deterministic Transmute scenario with one carried relic.

**Full-view comparison evidence**

- The environment fills the viewport and keeps the furnace, tools, and anvil in the left scenic zone.
- The action interface occupies the right side without the former oversized centered modal.
- The title, three-part state strip, paired action cards, ornamental Leave Forge control, and keyboard guide preserve the selected concept's hierarchy.

**Focused region comparison evidence**

- A separate focused crop was not needed because both action cards, generated raster emblems, copy, status strip, footer, and focus outline are legible in the 1440 x 900 full-view comparison.
- The denser Transmute state was captured separately to verify the relic image, rarity, description, sacrifice affordance, and footer in the same visual system.

**Findings**

- No actionable P0, P1, or P2 differences remain.
- Fonts and typography: the title uses the existing serif display language; status labels, action names, descriptions, and control hints retain distinct scale and weight.
- Spacing and layout rhythm: the left/right split, paired card geometry, status strip, and footer fit without viewport overflow.
- Colors and visual tokens: soot-black panels, ivory text, aged-metal borders, and warm-gold selection remain consistent with Camp and the chosen concept.
- Image quality and asset fidelity: the forge chamber, Temper emblem, Transmute emblem, relic icons, panel texture, and footer plaque are raster assets; no placeholder or code-drawn icon substitutes are visible.
- Copy and content: Temper, Transmute, carried-relic requirement, replacement count, depth, relic capacity, Leave Forge, and keyboard guide match the real game rules.
- Accessibility and behavior: one keyboard focus is visible; disabled Transmute remains readable; all interactive surfaces retain roles and accessible labels.
- Browser diagnostics: zero page errors and zero non-resource console errors.

**Comparison history**

1. The first rendered pass placed action content too low inside both cards, creating a large empty upper region.
2. Fix: changed each action card to an explicit two-row content stack, aligned the raster emblem and copy near the upper card region, and retained the lower breathing room from the selected concept.
3. Post-fix evidence: `forge-mode-final.png` and `comparison-final.png` show both action emblems, names, and descriptions in the intended visual hierarchy.

**Primary interactions tested**

- Initial focus on Temper.
- ArrowRight to Transmute and ArrowLeft back to Temper.
- ArrowDown to Leave Forge and ArrowUp back to an action.
- Enter from Temper opens the one-relic take-or-leave draft.
- In the Transmute scenario, Enter on the carried relic opens the three-choice replacement draft.
- Esc/Leave remains wired through the existing Forge flow.

final result: passed

## 2026-07-19 - Forge Temper and Transmute reward screens

**Source and implementation evidence**

- Source visual truth: `output/product-design/forge-anvil-sanctuary/reference.png`.
- Temper reward: `output/product-design/forge-anvil-sanctuary/implementation/forge-temper-reward-final.png`.
- Transmute replacements: `output/product-design/forge-anvil-sanctuary/implementation/forge-transmute-replacements-final.png`.
- Normalized three-panel comparison: `output/product-design/forge-anvil-sanctuary/implementation/forge-reward-comparison-final.jpg`.
- Viewport: 1440 x 900 desktop, deterministic Forge and Forge Transmute scenarios, HD preference set before startup.

**Comparison scope**

- The selected concept depicts the Forge mode screen rather than either reward state, so it is the visual-system target, not an exact content-layout target.
- The combined comparison verifies the same environmental crop, right-side hierarchy, status strip, soot-black materials, aged-metal borders, warm-gold selection, ornamental footer, and control guide across Mode, Temper, and Transmute.
- Separate full-resolution reward captures provide the focused evidence because card names, rarity, descriptions, relic art, selection borders, and take-or-leave actions are legible there.

**Findings and comparison history**

1. [P2] First reward captures still showed the global relic tooltip beside or over the Forge cards, duplicating already-visible descriptions and obscuring the composition.
2. Fix: Forge reward cards now suppress only their redundant tooltip attributes; generic relic drafts retain their existing tooltip behavior.
3. Post-fix evidence: both final captures have clear cards with no floating tooltip, while card copy remains fully visible.
4. No actionable P0, P1, or P2 findings remain.

**Required fidelity surfaces**

- Fonts and typography: Forge title, uppercase ritual labels, serif relic names, rarity labels, descriptions, and footer actions preserve the established hierarchy without clipping.
- Spacing and layout rhythm: Temper centers one ceremonial card; Transmute uses three equal cards; both retain the shared status strip, footer plaque, and scenic left column without viewport overflow.
- Colors and visual tokens: forge orange, soot black, aged iron, ivory copy, rarity accents, and warm-gold keyboard focus match the selected Forge language.
- Image quality and asset fidelity: the existing Forge environment and real relic raster icons are used directly; no placeholder, inline SVG, CSS-drawn, or text-glyph substitutes were introduced.
- Copy and content: Temper says take or leave; Transmute names the sacrificed relic, presents three replacements, and offers keeping the original relic.

**Primary interactions tested**

- Temper: one card, initial relic selection, ArrowDown to Leave Forged Relic, ArrowUp back, Enter completes the reward.
- Transmute: three replacement cards, ArrowRight across choices, ArrowDown to Keep Sacrificed Relic, ArrowUp back to the middle choice, Enter completes the reward.
- Each tested reward surface kept exactly one keyboard selection and remained inside the 1440 x 900 viewport.
- Browser diagnostics: zero page errors and zero failed Forge UI resources. The local HD preloader still reports unrelated missing boss-frame 404s that predate and do not affect these Forge screens.
- Contract test: `node tests/hd-relic-draft-screen.test.js` passed.

final result: passed

## 2026-07-19 - Underground Curio Market Merchant redesign

**Source visual truth**

- Existing HD system references: Ember Sanctuary Camp and Anvil Sanctuary Forge.
- Previous Merchant baseline: `output/hd-merchant-fullscreen/merchant-dashboard.png`.
- Generated environmental art: `assets/hd/ui/merchant/curio-market-background.png`.

**Implementation evidence**

- Final dashboard: `output/product-design/merchant-curio-market/implementation/merchant-dashboard-final.png`.
- Final Buyback: `output/product-design/merchant-curio-market/implementation/merchant-buyback-final.png`.
- Responsive dashboard and Buyback: `merchant-dashboard-1440x900.png` and `merchant-buyback-1440x900.png` in the same implementation folder.
- System comparison: `output/product-design/merchant-curio-market/merchant-system-comparison-final.jpg`.
- Before/after comparison: `output/product-design/merchant-curio-market/merchant-before-after-final.jpg`.

**Full-view comparison evidence**

- The generated curio market fills the viewport, reserves the left side for the hooded merchant and stocked stall, and leaves the right side for the complete interactive ledger.
- The Merchant now shares the environmental left / functional right composition, plaque hierarchy, soot-black materials, aged-metal borders, and gold keyboard focus established by Camp and Forge.
- Dashboard, Buyback, Black Market, Legendary Exchange, and relic replacement flows use one coherent HD Merchant system.

**Findings and comparison history**

1. [P1] The previous centered framed table lacked environmental storytelling and presented prices, categories, and interactions with weak hierarchy.
2. Fix: rebuilt the HD surface as an Underground Curio Market with a dedicated scenic background, right-side merchant ledger, section plaques, real item icons, explicit price columns, and visible item descriptions.
3. [P2] The first implementation pass inherited the generic Merchant flex basis of 1240 px and crowded the scenic zone.
4. Fix: set an explicit 920 px / 64 vw Merchant panel basis and repeated the 1920 x 1080 and 1440 x 900 captures.
5. No actionable P0, P1, or P2 findings remain.

**Required fidelity surfaces**

- Fonts and typography: display title, ritual tagline, ledger labels, item names, descriptions, and price labels preserve clear scale and weight.
- Spacing and layout rhythm: dashboard sections, status strip, Buyback grid, selection grids, and footer remain inside the 1440 x 900 HD viewport with no document overflow.
- Colors and visual tokens: aged iron, soot black, muted ivory, tarnished gold, and restrained rarity accents match Camp and Forge.
- Image quality and asset fidelity: the background and every visible item/relic symbol are raster assets; no emoji, placeholder boxes, inline SVG, or CSS-drawn icons were introduced.
- Copy and content: wallet, potion capacity, relic capacity, depth, prices, ownership, and Buyback valuation reflect live game state.
- Accessibility and behavior: keyboard focus remains singular and visible; HD descriptions are visible in-row, while Classic retains its tooltip-backed legacy rows.

**Primary interactions and boundary checks**

- Dashboard ArrowDown and ArrowRight movement passed, including navigation from Potion to Buyback and from Buyback to the neighboring offer.
- Selling one Buyback relic updated gold and removed one available row; V returned to the main dashboard.
- HD at 1440 x 900: 920 x 692 Buyback panel, exactly one keyboard selection, four loaded relic icons, no page errors, no viewport or document overflow.
- Classic at 1440 x 900: title remains Merchant, `merchant-sanctuary` is absent, no HD row icons/actions render, and the legacy panel remains inside the viewport.
- Contract test: `node tests/hd-merchant-screen.test.js` passed; `node --check game.js` and `git diff --check` passed.

final result: passed

## 2026-08-07 - Ranked Leaderboard and Inspect reference plates

**Source visual truth**

- Leaderboard: C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-0243c83e-6db0-445c-afeb-7d7f6b7b154d.png
- Inspect Build: C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-ba4d184b-18fa-43a1-9f46-34a5e2d330e6.png

**Implementation evidence**

- Leaderboard page 1: output/online-v3-ranked-headed/lifecycle/ranked-leaderboard.png
- Inspect Build: output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-detail.png
- Leaderboard page 2: output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-page-2.png
- Leaderboard page 10: output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-page-10.png
- Normalized comparisons: output/verification/ranked-reference-repair/final-leaderboard-full.jpg, final-inspect-full.jpg, and final-pages-1-2-10.jpg.
- Browser viewport and implementation capture: 1536 x 1080 CSS px at device scale 1.
- Source captures: 1487 x 1058 px. They were normalized to 1536 x 1080 before comparison so crop and density differences did not create false findings.
- State: true HD Ranked lifecycle, 73 authoritative fixture records, page 1 ranks 4-10, persistent Top 3, and a stored terminal defeat detail containing ten real relic icons and three real mutators.

**Full-view comparison evidence**

- Both surfaces use one uncropped 1536 x 1080 raster plate with the approved stone frame, candle alcoves, skull ornamentation, medal mounts, panels, and dark-metal palette.
- Dynamic copy is ordinary interactive DOM text over blank plate regions; no player name, rank, score, stat, item name, or action label is baked into the plate.
- Leaderboard title, permanent Top 3, seven-row ledger, and footer controls retain the reference hierarchy without horizontal or vertical viewport overflow.
- Inspect Build aligns the crowned rank medal, player summary, two-by-five live relic loadout, seven Chronicle rows, terminal result, Back, and Close controls with the reference regions.

**Focused region comparison evidence**

- Typography was measured in the browser after visual comparison. Rank 1 name is at least 25 px, its score at least 42 px, ledger copy at least 17 px, Inspect player name at least 60 px, Inspect score at least 45 px, Chronicle copy at least 17 px, and Back at least 20 px.
- The pts unit is independently scaled below the score number, matching the reference hierarchy.
- Page 2 starts at rank 11 and page 10 ends at rank 73 while the same Top 3 remain visible. Next is disabled on page 10.
- Returning from Inspect restores the exact ledger page that opened it.
- Inspect contains only Time Played, Rooms Cleared, Bosses Defeated, Mutators, Highest Depth, Gold Earned, and Final Score. Pacts, skills, camp upgrades, elixirs, and damage-stat sections are not rendered.
- The Mutators control is keyboard focusable and exposes all active mutator names, keys, bonuses, and drawbacks through the existing tooltip contract.
- The terminal panel shows the stored display-only cause "Defeated by The Hollow Seraph"; legacy records use the truthful "Cause not recorded" fallback.

**Findings and comparison history**

1. [P1] The first headed capture mixed Classic rendering with HD overlay CSS and therefore invalidated visual conclusions.
   Fix: the Ranked headed scenario now waits for the complete HD preload, checks the runtime mode, canvas class, and HD body class, and refuses to continue in Classic. A bounded reload handles only transient Chromium decode failures.
2. [P1] The first Inspect repair rendered the score as a generic inline span, so it escaped the positioned header and appeared in the upper-left corner.
   Fix: the shared score renderer now supports the correct semantic block tag for Inspect while preserving separate number and unit nodes.
3. [P2] The first reference-plate pass used live typography that was 10-15 percent too small.
   Fix: browser-measured RED thresholds were added, then optical sizes were calibrated at 1536 x 1080 and verified GREEN.
4. [P2] Single-stack relics displayed redundant "Carried" copy and the Mutators row displayed "3 active", both diverging from the reference.
   Fix: single-stack slots show only the live item name; stack text appears only above one, and the Chronicle shows the compact count with full information in the tooltip.
5. No actionable P0, P1, or P2 findings remain.

**Required fidelity surfaces**

- Fonts and typography: Georgia and Copperplate-compatible fallbacks, lighter engraving weights, locale-grouped values, restrained tracking, and separate score units reproduce the reference hierarchy without clipping.
- Spacing and layout rhythm: the full plate, podium, seven ledger rows, ten loadout slots, Chronicle, terminal block, and footer stay aligned at the tested desktop viewport.
- Colors and visual tokens: muted ivory, tarnished gold, silver, bronze, charcoal, and restrained defeat red remain consistent with the source plates.
- Image quality and asset fidelity: the two cleaned plate assets are true 1536 x 1080 PNGs with non-empty skull and crown regions. Relic slots use real game catalogue icons rather than placeholders or CSS drawings.
- Copy and content: all displayed names, ranks, values, relics, mutators, terminal text, page labels, and actions are live. The permanent Top 3 and pages 1-10 reflect authoritative server order.
- Accessibility and behavior: player names, Inspect, pagination, Back, Close, and Mutators are actual controls; focus-visible and reduced-motion rules remain present.

**Follow-up polish**

- P3: the original Inspect example includes tiny decorative Chronicle pictograms. The cleaned plate keeps the engraved rows text-first because no matching in-project raster icon set exists; this does not reduce readability or interaction.

final result: passed
## 2026-08-08 - Ranked reference-plate feedback calibration

**Source visual truth**

- Leaderboard reference: `C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-0243c83e-6db0-445c-afeb-7d7f6b7b154d.png`.
- Inspect Build reference: `C:\Users\Kamil\.codex\generated_images\019fbd02-789b-75b0-a741-d3e80ca2eedc\exec-ba4d184b-18fa-43a1-9f46-34a5e2d330e6.png`.
- User feedback capture: `C:\Users\Kamil\AppData\Local\Temp\codex-clipboard-a2ed064c-cba5-4345-b16e-0d9bc937a003.png`.

**Implementation evidence**

- Leaderboard: `output/online-v3-ranked-headed/lifecycle/ranked-leaderboard.png`.
- Inspect Build default state: `output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-detail.png`.
- Inspect Build relic-hover state: `output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-detail-tooltip.png`.
- Full-view normalized comparisons: `output/verification/ranked-feedback-anchors/leaderboard-reference-vs-implementation-final.jpg` and `output/verification/ranked-feedback-anchors/inspect-reference-vs-implementation-final.jpg`.
- Focused comparisons: `output/verification/ranked-feedback-anchors/leaderboard-focused-final.jpg` and `output/verification/ranked-feedback-anchors/inspect-focused-final.jpg`.
- Tooltip visual evidence: `output/verification/ranked-feedback-anchors/inspect-tooltip-final.jpg`.
- Browser viewport: 1536 x 1080 CSS px, `deviceScaleFactor: 1`.
- Source pixels: 1487 x 1058. Implementation pixels: 1536 x 1080. Source images were normalized to the implementation viewport before full-view and focused comparisons.
- State: true HD Ranked lifecycle with 73 fixture records, populated Top 3, ranks 4-10, ten populated relic slots, three mutators, and a stored terminal defeat.
- Responsive scope: desktop only. Mobile UX was explicitly deferred and was not evaluated in this pass.

**Full-view comparison evidence**

- Rank 2, Rank 1, and Rank 3 content now uses a symmetric plate-anchor grid. Browser centers are approximately 0.275, 0.500, and 0.725 of plate width, matching the three shield mounts.
- The ledger header and first populated row now share the same grid. Measured horizontal drift for Depth, Gold, and Inspect Build is 0 px, 0 px, and less than 0.001 px.
- Inspect Build now uses the ten empty engraved frames as the only visible loadout structure. Every populated frame contains one centered real catalogue icon; item names and stack copy no longer compete with the plate.
- Run Chronicle uses the engraved icon gutter and right value edge. Labels and values remain inside their seven rows without overlap or clipping.

**Focused region comparison evidence**

- Depth and Gold values inherit the 17 px-plus ledger type instead of the unrelated global 10.88 px row-span shorthand.
- Ten populated relic slots have zero visible label nodes. Browser geometry keeps every icon within 6 px of its slot center on both axes.
- Each occupied relic slot is keyboard focusable and exposes `name | description | Stack xN` through the shared tooltip contract. The hover tooltip is centered to within 1 px of its icon and remains fully inside the plate; the default capture confirms it disappears when hover/focus ends.
- Chronicle label insets measure 58-70 px and value insets 15-30 px at the tested viewport, preserving space for the engraved pictograms.

**Findings and comparison history**

1. [P1] The feedback capture placed Rank 2 about 44 px left of its silver mount and Rank 3 about 44 px right of its bronze mount.
   Fix: replaced the weighted three-column podium with an equal-column anchor map using calibrated 16.43% side insets.
   Post-fix evidence: `leaderboard-focused-final.jpg` and the browser center measurements show all three ranks seated in their shields.
2. [P1] Depth, Gold, and Inspect Build drifted progressively right because the inherited 16 px grid gap and row-only padding were added on top of six percentage tracks.
   Fix: removed the row padding and explicitly zeroed the desktop plate column gap.
   Post-fix evidence: the final headed audit reports effectively zero header-to-value drift for all three columns.
3. [P1] Visible relic names and stack labels crowded the generated empty frames and prevented icon alignment.
   Fix: removed visible loadout labels, mapped the five-by-two grid directly to the engraved frames, centered one real icon per frame, and moved name, description, and stack count into an accessible tooltip.
   Post-fix evidence: `inspect-focused-final.jpg` contains ten centered icons and no loadout copy; `inspect-tooltip-final.jpg` shows the complete hover state.
4. [P2] The initial calibrated Chronicle still left labels too close to the decorative pictograms.
   Fix: aligned the Chronicle panel to the plate, reserved an 18% left icon gutter, and retained a 6% right value inset.
   Post-fix evidence: `inspect-focused-final.jpg` matches the reference row rhythm and clears every pictogram.
5. [P2] Depth and Gold remained visibly undersized after their positions were corrected because a generic direct-child shorthand overrode the ledger font.
   Fix: made both fields inherit the calibrated ledger type.
   Post-fix evidence: `leaderboard-focused-final.jpg` shows readable values under their headings and the headed threshold passes at 16 px or larger.
6. [P2] The first relic tooltip inherited a 390 px right-aligned archive treatment and touched the left frame edge.
   Fix: centered a bounded 300 px tooltip above the active icon.
   Post-fix evidence: the headed geometry audit proves the tooltip center is within 1 px of the icon and both edges remain inside the plate.
7. No actionable P0, P1, or P2 findings remain.

**Required fidelity surfaces**

- Fonts and typography: display, score, ledger, Chronicle, terminal, and action hierarchy remain consistent with the references; grouped values and smaller `pts` units stay readable without clipping.
- Spacing and layout rhythm: podium mounts, six ledger tracks, ten loadout frames, seven Chronicle rows, terminal panel, and footer controls align to the raster plate at 1536 x 1080 with no viewport overflow.
- Colors and visual tokens: ivory, tarnished gold, silver, bronze, charcoal, and restrained defeat red remain sourced from the established HD plate treatment.
- Image quality and asset fidelity: the original cleaned 1536 x 1080 raster plates and real relic catalogue icons are used directly. No placeholder, emoji, CSS-drawn, inline-SVG, or text-glyph asset substitutes were introduced.
- Copy and content: leaderboard data, Chronicle values, terminal result, mutator count, and tooltip details are live DOM content. Inspect intentionally omits pacts, skills, camp upgrades, elixirs, and damage statistics.
- Accessibility and behavior: player names, Inspect, pagination, Back, Close, Mutators, and relic slots retain real focusable controls or focusable informational targets; tooltip content is available on hover and keyboard focus.

**Primary interactions and diagnostics**

- Opened the Ranked leaderboard, inspected the Top 3 and ranks 4-10, opened Inspect Build, hovered a relic tooltip, removed hover, returned to the same page, paged to page 2, and paged through page 10 while Top 3 remained present.
- Verified ten occupied icon slots, seven Chronicle labels, terminal cause, exact page return, and disabled Next on page 10.
- Final true-HD lifecycle completed with zero unexpected console errors and zero page errors.

final result: passed

## 2026-08-08 - Ranked Leaderboard and Inspect Build detailed re-audit

**Audit scope and source truth**

- Re-audited the desktop HD surfaces against the approved Leaderboard and
  Inspect Build source images at a 1536 x 1080 CSS-pixel viewport with device
  scale 1. Mobile UX remains explicitly deferred.
- Fresh implementation captures cover Leaderboard pages 1, 2, and 10; Inspect
  default state; a short first-row relic tooltip; a long second-row relic
  tooltip; and the Mutators tooltip.
- Final side-by-side evidence is stored in
  `output/verification/ranked-detailed-reaudit-20260808/60-leaderboard-accepted-reference-vs-implementation.jpg`
  and
  `output/verification/ranked-detailed-reaudit-20260808/61-inspect-accepted-reference-vs-implementation.jpg`.
- Tooltip-state evidence is stored in
  `output/verification/ranked-detailed-reaudit-20260808/62-tooltip-suite-accepted.jpg`.

**Findings corrected during this pass**

1. [P2] Inspect header rendered Depth and Gold as flat, same-size text and
   omitted the two engraved vertical separators visible in the approved
   composition.
   Fix: split each stat into label and value elements, restored the separators,
   and calibrated their type and positions against browser geometry.
2. [P2] Inspect exposed both Back and a small Close action although the approved
   screen has one clear exit action.
   Fix: retained only Back to Leaderboard and preserved exact-page return.
3. [P2] The terminal result copy was centered on the skull instead of occupying
   the text region beside it.
   Fix: anchored the Game Over title, outcome, and cause independently; the
   dynamic cause now reads beside the medallion without competing with it.
4. [P2] The first-row relic tooltip opened upward over the Build Loadout title.
   Fix: short tooltips now open in the inter-row gap, remain inside the plate,
   and use readable 12 px-plus text.
5. [P2] A long tooltip from the second row also opened upward across the relic
   grid.
   Fix: lower-row tooltips now use the intentionally blank lower loadout region
   and remain above the Back action.
6. [P2] The Mutators tooltip existed in the DOM but was visually clipped by its
   host button's overflow rule.
   Fix: the host permits the tooltip to escape its row while browser assertions
   verify complete content, bounds, and readable type.

**Accepted final state**

- Leaderboard Top 3 remain seated in the silver, gold, and bronze mounts on all
  ten pages. Pages 1, 2, and 10 retain the same seven-row ledger alignment and
  the final Next state is disabled.
- Inspect uses ten centered real catalogue icons with no visible relic names;
  names, descriptions, and stack counts remain available on mouse hover and
  keyboard focus.
- Run Chronicle renders exactly Time Played, Rooms Cleared, Bosses Defeated,
  Mutators, Highest Depth, Gold Earned, and Final Score. No stored private or
  out-of-scope build statistics are invoked by this surface.
- The current real game relic art has circular inventory frames unlike the
  concept's object cutouts. This is an intentional use of authoritative project
  assets, not a placeholder or invented asset treatment.
- No actionable P0, P1, or P2 visual or interaction findings remain at the
  audited desktop viewport.

**Verification**

- Focused reference asset/style/UI tests: 8/8 PASS.
- Focused M4 client leaderboard tests: 7/7 PASS.
- JavaScript syntax checks: PASS for the renderer and headed QA script.
- Final true-HD Ranked lifecycle: PASS with zero unexpected console or page
  errors; log:
  `output/verification/ranked-headed-20260808T181354996Z.log`.
- `verify:phase`: 780/780 PASS; log:
  `output/verification/phase-20260808T182230462Z.log`.
- `verify:baseline`: 3/3 PASS plus clean committed headed baseline; log:
  `output/verification/baseline-20260808T182353668Z.log`.

final result: passed
