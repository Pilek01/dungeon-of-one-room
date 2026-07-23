# Portal and Brazier Corrections Design

## Goal

Remove visible portal bobbing and clipping, replace the HD torch-looking props with floor braziers, and preserve every existing gameplay identifier so the future Classic/HD selector can swap render assets without changing map data or saves.

## Compatibility contract

- Keep map marker `3`, every `torch` manifest key, current filenames, and renderer fallbacks unchanged.
- Keep Classic assets and gameplay state untouched.
- Change only HD source processing and resulting HD PNGs.
- Keep music, soundtrack, and all audio files unchanged.

## Portal construction

Each portal animation uses one immutable outer shell. Active frames are composited from that shell plus a central animated magic region. Pixels outside the theme-specific inner aperture must be byte-identical across all three active frames. The canvas, bottom anchor, and alpha bounds remain fixed.

The common portal animates only its violet swirl. Vault and otter portals may animate the inner field and contained glow. The forge portal may additionally animate its two flames and glow, but the stone/metal structure and its position remain fixed.

## Brazier construction

The HD prop remains technically named `torch`, but visually becomes a grounded brazier. Every theme has one immutable bowl, stem/base, and footprint plus three flame overlays. Only flame, embers, and tightly contained glow may vary between lit frames.

- Common: dark iron or bronze bowl, warm orange flame.
- Corruption: aged green-bronze bowl, sickly green/violet accents.
- Abyss: blackened iron bowl, blue-violet flame.

All variants fit the existing 64 x 64 bottom-centered draw contract.

## Verification

Automated tests compare animation frames outside explicit motion masks and require exact equality. They also verify stable alpha bounds, meaningful visual coverage, preserved `torch` identifiers, deterministic rebuilds, unchanged audio hashes, and the existing browser visual matrix.
