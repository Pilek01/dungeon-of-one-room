# Room backup before thin south-wall redesign

Created on 2026-07-15 before changing the HD room perspective and removing the
top/bottom boss-room ornaments.

The backup preserves:

- all generated HD standard, special, and boss room backgrounds;
- all matching Task 8 source images (original and normalized 1024 px copies);
- the room generator, renderer integration, reservation logic, focused tests,
  and room asset lock file.

## Restore

Copy the contents of this directory over the project root while preserving the
relative paths. Then run:

```powershell
python scripts/build-hd-room-assets.py --update-lock
```

This restores both the room artwork and the integration state that existed
before the redesign.
