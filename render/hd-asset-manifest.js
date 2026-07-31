(function attachHDAssetManifest(root, factory) {
  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.DungeonHDAssetManifest = api;
  }
})(typeof window !== "undefined" ? window : null, function createHDAssetManifestApi(root) {
  "use strict";

  const KEY_PATTERN = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}(?:\.[0-9]{2})?$/;
  const GROUP_PATTERN = /^[a-z][a-z0-9-]*$/;
  const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)$/;
  const hasOwn = (source, key) => Object.prototype.hasOwnProperty.call(source, key);
  const expansionArtEntries = typeof module === "object" && module.exports
    ? require("./hd-expansion-art-entries.js")
    : root && Array.isArray(root.DungeonHDExpansionArtEntries)
      ? root.DungeonHDExpansionArtEntries
      : [];

  const descentEntries = [
    {
      key: "environment.descent.floor.base",
      src: "assets/hd/environment/descent/floor-base.png",
      group: "environment",
      critical: true
    },
    ...["b", "c", "skull", "crack_cross", "var3", "var4"].map((variant) => ({
      key: `environment.descent.floor.${variant}`,
      src: `assets/hd/environment/descent/floor-${variant.replaceAll("_", "-")}.png`,
      group: "environment",
      critical: false
    })),
    {
      key: "environment.descent.wall.north",
      src: "assets/hd/environment/descent/wall-north.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.wall.south",
      src: "assets/hd/environment/descent/wall-south.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.wall.east",
      src: "assets/hd/environment/descent/wall-east.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.wall.west",
      src: "assets/hd/environment/descent/wall-west.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.corner.northwest",
      src: "assets/hd/environment/descent/wall-corner-northwest.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.corner.northeast",
      src: "assets/hd/environment/descent/wall-corner-northeast.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.corner.southwest",
      src: "assets/hd/environment/descent/wall-corner-southwest.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.corner.southeast",
      src: "assets/hd/environment/descent/wall-corner-southeast.png",
      group: "environment",
      critical: true
    },
    {
      key: "environment.descent.decal.crack",
      src: "assets/hd/environment/descent/decal-crack.png",
      group: "environment",
      critical: false
    },
    {
      key: "environment.descent.grate.base",
      src: "assets/hd/environment/descent/grate.png",
      group: "environment",
      critical: false
    },
    {
      key: "environment.descent.rubble.base",
      src: "assets/hd/environment/descent/rubble.png",
      group: "environment",
      critical: false
    },
    {
      key: "environment.descent.decal.stain01",
      src: "assets/hd/environment/descent/decal-stain-01.png",
      group: "environment",
      critical: false
    },
    {
      key: "environment.descent.decal.stain02",
      src: "assets/hd/environment/descent/decal-stain-02.png",
      group: "environment",
      critical: false
    },
    {
      key: "environment.descent.decal.stain03",
      src: "assets/hd/environment/descent/decal-stain-03.png",
      group: "environment",
      critical: false
    },
    {
      key: "object.common.torch.unlit",
      src: "assets/hd/objects/common/torch-unlit.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.torch.lit01",
      src: "assets/hd/objects/common/torch-lit-01.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.torch.lit02",
      src: "assets/hd/objects/common/torch-lit-02.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.torch.lit03",
      src: "assets/hd/objects/common/torch-lit-03.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.chest.normal",
      src: "assets/hd/objects/common/chest-normal.png",
      group: "objects",
      critical: false
    },
    ...["descent", "corruption", "abyss", "forge", "pact", "vault", "otter"].map((variant) => ({
      key: `object.chest.${variant}`,
      src: `assets/hd/objects/chest/${variant}.png`,
      group: "objects",
      critical: false
    })),
    {
      key: "object.common.shrine.inactive",
      src: "assets/hd/objects/common/shrine-inactive.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.shrine.active",
      src: "assets/hd/objects/common/shrine-active.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.portal.inactive",
      src: "assets/hd/objects/common/portal-inactive.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.portal.active01",
      src: "assets/hd/objects/common/portal-active-01.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.portal.active02",
      src: "assets/hd/objects/common/portal-active-02.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.portal.active03",
      src: "assets/hd/objects/common/portal-active-03.png",
      group: "objects",
      critical: false
    },
    {
      key: "object.common.portal.frame",
      src: "assets/hd/objects/common/portal-frame.png",
      group: "objects",
      critical: false
    },
    ...Array.from({ length: 8 }, (_, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      return {
        key: `object.common.portal.swirl${suffix}`,
        src: `assets/hd/objects/common/portal-swirl-${suffix}.png`,
        group: "objects",
        critical: false
      };
    }),
    {
      key: "hazard.common.spikes.armed",
      src: "assets/hd/hazards/common/spikes-armed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "hazard.descent.spikes.armed",
      src: "assets/hd/hazards/descent/spikes-armed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "hazard.common.mine.unarmed",
      src: "assets/hd/hazards/common/mine-unarmed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "hazard.common.mine.armed",
      src: "assets/hd/hazards/common/mine-armed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "hazard.descent.mine.unarmed",
      src: "assets/hd/hazards/descent/mine-unarmed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "hazard.descent.mine.armed",
      src: "assets/hd/hazards/descent/mine-armed.png",
      group: "hazards",
      critical: false
    }
  ];

  const playerEntries = [];
  const playerDirections = ["south", "north", "east", "west"];
  const playerClips = [
    ["idle", 4],
    ["move", 4],
    ["attack", 4],
    ["hit", 2],
    ["death", 2]
  ];
  for (const direction of playerDirections) {
    for (const [clip, frameCount] of playerClips) {
      for (let frame = 1; frame <= frameCount; frame += 1) {
        const suffix = String(frame).padStart(2, "0");
        playerEntries.push({
          key: `actor.player.${direction}.${clip}.${suffix}`,
          src: `assets/hd/actors/player/frames/${direction}-${clip}-${suffix}.png`,
          group: "player",
          critical: true
        });
      }
    }
  }

  const enemyEntries = [];
  const enemyRoster = ["slime", "skeleton", "brute", "acolyte", "skitter", "totem", "otter", "riftweaver", "bulwark"];
  const enemyDirections = ["south", "north", "east", "west"];
  const mobileEnemyClips = [["idle", 4], ["move", 4], ["attack", 4], ["hit", 2], ["death", 2]];
  const totemClips = [["idle", 4], ["awaken", 4], ["cast", 4], ["hit", 2], ["death", 2]];
  for (const type of enemyRoster) {
    const directions = type === "totem" ? ["base"] : enemyDirections;
    const clips = type === "totem" ? totemClips : mobileEnemyClips;
    for (const direction of directions) {
      for (const [clip, frameCount] of clips) {
        for (let frame = 1; frame <= frameCount; frame += 1) {
          const suffix = String(frame).padStart(2, "0");
          enemyEntries.push({
            key: `enemy.${type}.${direction}.${clip}.${suffix}`,
            src: `assets/hd/enemies/${type}/frames/${direction}-${clip}-${suffix}.png`,
            group: "enemies",
            critical: true
          });
        }
      }
    }
  }

  const bossEntries = [];
  const bossProfiles = [
    { folder: "vault-guardian", key: "guardian", action: "attack" },
    { folder: "blacksmith-guardian", key: "blacksmith_guardian", action: "attack" },
    { folder: "warden/phase-1", key: "warden.phase1", action: "cast" },
    { folder: "warden/phase-2", key: "warden.phase2", action: "cast" }
  ];
  for (const profile of bossProfiles) {
    for (const direction of ["south", "north", "east", "west"]) {
      for (const [clipName, frameCount] of [["idle", 4], ["move", 4], [profile.action, 4], ["hit", 2], ["death", 2]]) {
        for (let frame = 1; frame <= frameCount; frame += 1) {
          const suffix = String(frame).padStart(2, "0");
          bossEntries.push({
            key: `boss.${profile.key}.${direction}.${clipName}.${suffix}`,
            src: `assets/hd/bosses/${profile.folder}/frames/${direction}-${clipName}-${suffix}.png`,
            group: "bosses",
            critical: true
          });
        }
      }
    }
  }
  for (const theme of ["descent", "corruption", "abyss"]) {
    for (const direction of ["south", "north", "east", "west"]) {
      for (const [clipName, frameCount] of [["idle", 4], ["move", 4], ["cast", 4], ["hit", 2], ["death", 2]]) {
        for (let frame = 1; frame <= frameCount; frame += 1) {
          const suffix = String(frame).padStart(2, "0");
          bossEntries.push({
            key: `boss.warden.${theme}.${direction}.${clipName}.${suffix}`,
            src: `assets/hd/bosses/warden-biome-${theme}/frames/${direction}-${clipName}-${suffix}.png`,
            group: "bosses",
            critical: true
          });
        }
      }
    }
  }
  for (const overlay of [
    ["blacksmith_guardian.overlay.barrier", "blacksmith-barrier"],
    ["warden.overlay.voidaegis", "warden-void-aegis"]
  ]) {
    for (let frame = 1; frame <= 4; frame += 1) {
      const suffix = String(frame).padStart(2, "0");
      bossEntries.push({
        key: `boss.${overlay[0]}.${suffix}`,
        src: `assets/hd/bosses/overlays/frames/${overlay[1]}-${suffix}.png`,
        group: "bosses",
        critical: false
      });
    }
  }

  const protectionEntries = [];
  for (const effect of ["player-shield", "player-barrier", "blacksmith-barrier", "warden-aegis"]) {
    const semanticEffect = effect.replaceAll("-", "_");
    for (const layer of ["rear", "front"]) {
      for (let frame = 1; frame <= 8; frame += 1) {
        const suffix = String(frame).padStart(2, "0");
        protectionEntries.push({
          key: `fx.protection.${semanticEffect}.${layer}.${suffix}`,
          src: `assets/hd/vfx/protection/${effect}/${layer}-${suffix}.png`,
          group: "fx",
          critical: false
        });
      }
    }
  }

  const themedEnvironmentEntries = [];
  const themedEnvironmentSlots = [
    ["floor.base", "floor-base", true],
    ["floor.b", "floor-b", false],
    ["floor.c", "floor-c", false],
    ["floor.skull", "floor-skull", false],
    ["floor.crack_cross", "floor-crack-cross", false],
    ["floor.var3", "floor-var3", false],
    ["floor.var4", "floor-var4", false],
    ["wall.north", "wall-north", true],
    ["wall.south", "wall-south", true],
    ["wall.east", "wall-east", true],
    ["wall.west", "wall-west", true],
    ["corner.northwest", "wall-corner-northwest", true],
    ["corner.northeast", "wall-corner-northeast", true],
    ["corner.southwest", "wall-corner-southwest", true],
    ["corner.southeast", "wall-corner-southeast", true],
    ["decal.crack", "decal-crack", false],
    ["grate.base", "grate", false],
    ["rubble.base", "rubble", false],
    ["decal.stain01", "decal-stain-01", false],
    ["decal.stain02", "decal-stain-02", false],
    ["decal.stain03", "decal-stain-03", false],
    ["decal.sigil", "decal-sigil", false],
    ["decal.vein", "decal-vein", false],
    ["decal.dust", "decal-dust", false],
    ["decal.scar", "decal-scar", false],
    ["decal.residue", "decal-residue", false],
    ["torch.unlit", "torch-unlit", false],
    ["torch.lit01", "torch-lit-01", false],
    ["torch.lit02", "torch-lit-02", false],
    ["torch.lit03", "torch-lit-03", false]
  ];
  for (const theme of ["corruption", "abyss"]) {
    for (const [suffix, filename, critical] of themedEnvironmentSlots) {
      themedEnvironmentEntries.push({
        key: `environment.${theme}.${suffix}`,
        src: `assets/hd/environment/${theme}/${filename}.png`,
        group: "environment",
        critical
      });
    }
    themedEnvironmentEntries.push({
      key: `hazard.${theme}.spikes.armed`,
      src: `assets/hd/hazards/${theme}/spikes-armed.png`,
      group: "hazards",
      critical: false
    });
    for (const state of ["unarmed", "armed"]) {
      themedEnvironmentEntries.push({
        key: `hazard.${theme}.mine.${state}`,
        src: `assets/hd/hazards/${theme}/mine-${state}.png`,
        group: "hazards",
        critical: false
      });
    }
  }
  themedEnvironmentEntries.push({
    key: "hazard.beyond.spikes.armed",
    src: "assets/hd/hazards/beyond/spikes-armed.png",
    group: "hazards",
    critical: false
  });
  for (const state of ["unarmed", "armed"]) {
    themedEnvironmentEntries.push({
      key: `hazard.beyond.mine.${state}`,
      src: `assets/hd/hazards/beyond/mine-${state}.png`,
      group: "hazards",
      critical: false
    });
  }
  themedEnvironmentEntries.push({
    key: "environment.forge.room",
    src: "assets/hd/environment/forge/room.png",
    group: "environment",
    critical: false
  });
  themedEnvironmentEntries.push({
    key: "environment.vault.room",
    src: "assets/hd/environment/vault/room.png",
    group: "environment",
    critical: false
  });
  themedEnvironmentEntries.push({
    key: "environment.otter.room",
    src: "assets/hd/environment/otter/room.png",
    group: "environment",
    critical: false
  });
  for (const theme of ["descent", "corruption", "abyss", "beyond"]) {
    for (let variant = 1; variant <= 3; variant += 1) {
      const suffix = String(variant).padStart(2, "0");
      themedEnvironmentEntries.push({
        key: `environment.${theme}.room${suffix}`,
        src: `assets/hd/environment/${theme}/room-${suffix}.png`,
        group: "environment",
        critical: false
      });
    }
    themedEnvironmentEntries.push({
      key: `environment.${theme}.bossroom`,
      src: `assets/hd/environment/${theme}/boss-room.png`,
      group: "environment",
      critical: false
    });
  }
  for (let mask = 0; mask < 16; mask += 1) {
    const suffix = String(mask).padStart(2, "0");
    themedEnvironmentEntries.push({
      key: `hazard.beyond.pit.${suffix}`,
      src: `assets/hd/hazards/beyond/pit-${suffix}.png`,
      group: "hazards",
      critical: false
    });
  }

  const roomPropEntries = [];
  function addRoomProp(key, folder, filename) {
    roomPropEntries.push({
      key,
      src: `assets/hd/objects/${folder}/${filename}.png`,
      group: "objects",
      critical: false
    });
  }
  for (let frame = 1; frame <= 4; frame += 1) {
    const suffix = String(frame).padStart(2, "0");
    addRoomProp(`object.merchant.idle${suffix}`, "merchant", `idle-${suffix}`);
  }
  for (const state of ["dormant", "ready01", "ready02", "used"]) {
    addRoomProp(`object.forge.${state}`, "forge", state);
    addRoomProp(`object.pact.${state}`, "pact", state);
  }
  for (const state of ["blocked", "cleared"]) {
    addRoomProp(`object.vault.seal.${state}`, "vault", `seal-${state}`);
    addRoomProp(`object.otter.seal.${state}`, "otter", `seal-${state}`);
  }
  for (const group of ["vault", "otter", "forge", "warden"]) {
    for (const state of ["inactive", "active01", "active02", "active03"]) {
      addRoomProp(`object.${group}.portal.${state}`, group, `portal-${state}`);
    }
    addRoomProp(`object.${group}.portal.frame`, group, "portal-frame");
    for (let phase = 1; phase <= 8; phase += 1) {
      const suffix = String(phase).padStart(2, "0");
      addRoomProp(`object.${group}.portal.swirl${suffix}`, group, `portal-swirl${suffix}`);
    }
  }
  for (const state of ["ready", "opened"]) {
    addRoomProp(`object.otter.chest.${state}`, "otter", `chest-${state}`);
  }
  for (const state of ["phase01", "phase02"]) {
    addRoomProp(`object.boss.floorseal.${state}`, "boss", `floorseal-${state}`);
  }
  for (const direction of ["north", "south"]) {
    addRoomProp(`object.boss.relief.${direction}`, "boss", `relief-${direction}`);
  }

  const vaultGuardianVfxEntries = [];
  for (let frame = 1; frame <= 4; frame += 1) {
    const suffix = String(frame).padStart(2, "0");
    for (const descriptor of [
      ["object.vault.chest_lock", "assets/hd/objects/vault/chest-lock", "lock", "objects"],
      ["object.vault.chest_destroyed", "assets/hd/objects/vault/chest-destroyed", "debris", "objects"],
      ["vfx.vault.hoard_sentence.mark", "assets/hd/vfx/vault/hoard-sentence/mark", "mark", "vfx"],
      ["vfx.vault.hoard_sentence.cast", "assets/hd/vfx/vault/hoard-sentence/cast", "cast", "vfx"],
      ["vfx.vault.seal_break", "assets/hd/vfx/vault/seal-break", "break", "vfx"],
      ["vfx.vault.lockdown.tile", "assets/hd/vfx/vault/lockdown/tile", "tile", "vfx"],
      ["vfx.vault.lockdown.anchor", "assets/hd/vfx/vault/lockdown/anchor", "anchor", "vfx"],
      ["vfx.vault.lockdown.detonation", "assets/hd/vfx/vault/lockdown/detonation", "detonation", "vfx"]
    ]) {
      vaultGuardianVfxEntries.push({
        key: `${descriptor[0]}.${descriptor[2]}${suffix}`,
        src: `${descriptor[1]}/${descriptor[2]}-${suffix}.png`,
        group: descriptor[3],
        critical: false
      });
    }
  }

  const statusEntries = [
    "bleed", "poison", "burn", "freeze", "disorient", "enemy_buff",
    "fury", "attack_up", "armor_up", "max_hp_up", "lifesteal", "elixir",
    "shield", "barrier", "second_chance", "shrine_blessing",
    "chaos", "pact", "hunger", "swap", "noise", "soul_harvest",
    "storm_sigil", "quickloader", "chest_upgrade", "last_stand",
    "elite", "relentless", "juggernaut", "blooddrinker", "thorned", "volatile"
  ].map((id) => ({
    key: `ui.status.${id}`,
    src: `assets/hd/ui/status/${id.replaceAll("_", "-")}.png`,
    group: "ui-status",
    critical: false
  }));

  // These descriptors reserve stable semantic keys for later art tasks. They stay
  // optional until their production files ship, so staged work cannot block the
  // complete Descent room base from entering HD mode.
  const futureEntries = [
    {
      key: "actor.player.south.idle",
      src: "assets/hd/actors/player-south-idle.png",
      group: "player",
      critical: false
    },
    {
      key: "boss.warden.phase2.idle",
      src: "assets/hd/bosses/warden-phase2-idle.png",
      group: "bosses",
      critical: false
    },
    {
      key: "object.shrine.active",
      src: "assets/hd/objects/shrine-active.png",
      group: "objects",
      critical: false
    },
    {
      key: "hazard.mine.armed",
      src: "assets/hd/hazards/mine-armed.png",
      group: "hazards",
      critical: false
    },
    {
      key: "fx.shockwave.base",
      src: "assets/hd/effects/shockwave-base.png",
      group: "effects",
      critical: false
    }
  ];

  function assertSafeImagePath(src, index) {
    if (typeof src !== "string" || !src.startsWith("assets/hd/")) {
      throw new TypeError(`Manifest entry ${index} src must be under assets/hd/`);
    }
    if (
      src.includes("\\") ||
      src.includes("..") ||
      src.includes("//") ||
      src.includes("?") ||
      src.includes("#") ||
      !IMAGE_EXTENSION_PATTERN.test(src)
    ) {
      throw new TypeError(`Manifest entry ${index} has an unsafe or non-image src path`);
    }

    const relativeSegments = src.slice("assets/hd/".length).split("/");
    const fileName = relativeSegments.pop();
    const fileStem = fileName.replace(IMAGE_EXTENSION_PATTERN, "");
    const safeSegment = /^[a-z0-9][a-z0-9-]*$/;
    if (relativeSegments.includes("audio")) {
      throw new TypeError(`Manifest entry ${index} uses the forbidden audio path domain`);
    }
    if (!fileStem || !safeSegment.test(fileStem) || relativeSegments.some((part) => !safeSegment.test(part))) {
      throw new TypeError(`Manifest entry ${index} has an unsafe src path segment`);
    }
  }

  function validateSnapshotRecords(candidate) {
    if (!Array.isArray(candidate)) {
      throw new TypeError("HD asset manifest must be an array");
    }

    const keys = new Set();
    for (let index = 0; index < candidate.length; index += 1) {
      if (!hasOwn(candidate, index)) {
        throw new TypeError(`Manifest entry ${index} must be present; sparse arrays are not allowed`);
      }
      const asset = candidate[index];
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        throw new TypeError(`Manifest entry ${index} must be an object`);
      }
      if (typeof asset.key !== "string" || !KEY_PATTERN.test(asset.key)) {
        throw new TypeError(`Manifest entry ${index} has a malformed semantic key`);
      }
      if (asset.key.split(".")[0] === "audio") {
        throw new TypeError(`Manifest entry ${index} uses the forbidden audio domain`);
      }
      if (keys.has(asset.key)) {
        throw new TypeError(`Manifest contains duplicate key: ${asset.key}`);
      }
      keys.add(asset.key);

      if (typeof asset.group !== "string" || !GROUP_PATTERN.test(asset.group)) {
        throw new TypeError(`Manifest entry ${index} has a malformed group`);
      }
      if (asset.group === "audio") {
        throw new TypeError(`Manifest entry ${index} uses the forbidden audio group`);
      }
      if (typeof asset.critical !== "boolean") {
        throw new TypeError(`Manifest entry ${index} critical must be a boolean`);
      }
      assertSafeImagePath(asset.src, index);
    }

    return true;
  }

  function snapshotManifest(candidate) {
    if (!Array.isArray(candidate)) {
      throw new TypeError("HD asset manifest must be an array");
    }

    const snapshots = new Array(candidate.length);
    for (let index = 0; index < candidate.length; index += 1) {
      if (!hasOwn(candidate, index)) {
        throw new TypeError(`Manifest entry ${index} must be present; sparse arrays are not allowed`);
      }
      const asset = candidate[index];
      if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
        throw new TypeError(`Manifest entry ${index} must be an object`);
      }
      snapshots[index] = Object.freeze({
        key: asset.key,
        src: asset.src,
        group: asset.group,
        critical: asset.critical
      });
    }
    validateSnapshotRecords(snapshots);
    return Object.freeze(snapshots);
  }

  function validateManifest(candidate) {
    snapshotManifest(candidate);
    return true;
  }

  const entries = snapshotManifest([
    ...descentEntries,
    ...playerEntries,
    ...enemyEntries,
    ...bossEntries,
    ...protectionEntries,
    ...themedEnvironmentEntries,
    ...roomPropEntries,
    ...vaultGuardianVfxEntries,
    ...statusEntries,
    ...expansionArtEntries.filter((entry) => !entry.key.startsWith("enemy.riftweaver.") && !entry.key.startsWith("enemy.bulwark."))
  ]);
  const stagedEntries = snapshotManifest(futureEntries);
  const catalogEntries = Object.freeze([...entries, ...stagedEntries]);

  function getByKey(key, candidate) {
    const snapshots = candidate === undefined
      ? catalogEntries
      : candidate === entries
        ? entries
        : candidate === stagedEntries
          ? stagedEntries
          : snapshotManifest(candidate);
    return snapshots.find((asset) => asset.key === key);
  }

  function selectGroup(group, candidate = entries) {
    if (typeof group !== "string" || !GROUP_PATTERN.test(group) || group === "audio") {
      throw new TypeError("HD asset group must be a safe, non-audio group name");
    }
    const snapshots = candidate === entries ? entries : snapshotManifest(candidate);
    return snapshots.filter((asset) => asset.group === group);
  }

  return Object.freeze({
    entries,
    stagedEntries,
    snapshotManifest,
    validateManifest,
    getByKey,
    selectGroup
  });
});
