# Beyond HD ImageGen prompt set

Generation mode: built-in Codex ImageGen (`image_gen`).

## Connected pit autotile v2

Built-in ImageGen edit of the approved pit atlas. The reference atlas defines
the dark stone, black void and restrained violet-crack style. Output is an exact
4x4 row-major cardinal bitmask atlas: top=1, right=2, bottom=4, left=8. Open
sides remove the internal stone rim and extend a broad, aligned black-violet
connector to the cell edge so adjacent tiles read as one chasm. Flat `#ff00ff`
chroma-key background; identical scale, perspective and padding; no text,
labels, grid lines, watermark or full-atlas frame.

The four room sources use the existing Abyss room composition as the camera and
playable-area reference and the original HD Warden as the Beyond identity
reference. All rooms preserve an open 7x7 arena and a thin southern perspective
lip. The standard variants are Gate of Nowhere, Hall of Broken Orbits and
Reliquary of Silence. The boss room is the Throne of the Last Horizon and keeps
its center empty for the existing runtime seal.

The pit source is a 4x4 chroma-key atlas containing sixteen cardinal-connectivity
variants: cracked black-basalt rims, a deep violet-black drop and restrained
falling motes on a flat `#ff00ff` background. It is normalized into sixteen
64x64 RGBA gameplay tiles by `scripts/build-beyond-assets.py`.
