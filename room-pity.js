(function () {
  const FORGE_PITY_DEPTH = 21;
  const OTTER_PITY_DEPTH = 41;
  const MERCHANT_FIRST_DEPTH = 9;
  const MERCHANT_LAST_DEPTH = 99;
  // Retained for historical Ranked rulesets. New runs use absolute depth.
  const MERCHANT_FIRST_ROOM_INDEX = 8;
  const MERCHANT_LAST_ROOM_INDEX = 98;
  const MERCHANT_ROOM_INTERVAL = 10;
  const SPECIAL_ROOM_GLOBAL_GAP_DEPTHS = 2;
  const SPECIAL_ROOM_COOLDOWN_DEPTHS = Object.freeze({
    forge: 20,
    pact: 10,
    crossroads: 15,
    arena: 10,
    otter: 20
  });
  const NATURAL_SPECIAL_ROOM_SOURCES = new Set([
    "weighted-room",
    "queued-otter",
    "forge-pity",
    "otter-pity"
  ]);

  function isScheduledMerchantRoom(roomIndex) {
    const index = Math.floor(Number(roomIndex));
    return Number.isFinite(index) &&
      index >= MERCHANT_FIRST_ROOM_INDEX &&
      index <= MERCHANT_LAST_ROOM_INDEX &&
      (index - MERCHANT_FIRST_ROOM_INDEX) % MERCHANT_ROOM_INTERVAL === 0;
  }

  function isScheduledMerchantDepth(depth) {
    return Number.isSafeInteger(depth) &&
      depth >= MERCHANT_FIRST_DEPTH && depth <= MERCHANT_LAST_DEPTH &&
      (depth - MERCHANT_FIRST_DEPTH) % MERCHANT_ROOM_INTERVAL === 0;
  }

  function isNaturalSpecialRoomEligible(roomType, depth, scheduleState = {}) {
    const type = String(roomType || "");
    const cooldown = Number(SPECIAL_ROOM_COOLDOWN_DEPTHS[type]);
    if (!Number.isFinite(cooldown)) return true;
    const currentDepth = Math.max(0, Math.floor(Number(depth) || 0));
    const lastByType = scheduleState.lastIssuedDepthByType &&
      typeof scheduleState.lastIssuedDepthByType === "object"
      ? scheduleState.lastIssuedDepthByType
      : {};
    const lastTypeDepth = Number(lastByType[type]);
    if (Number.isFinite(lastTypeDepth) && currentDepth - lastTypeDepth < cooldown) {
      return false;
    }
    const lastNaturalSpecialDepth = scheduleState.lastNaturalSpecialDepth == null
      ? NaN
      : Number(scheduleState.lastNaturalSpecialDepth);
    if (
      Number.isFinite(lastNaturalSpecialDepth) &&
      currentDepth - lastNaturalSpecialDepth <= SPECIAL_ROOM_GLOBAL_GAP_DEPTHS
    ) {
      return false;
    }
    return true;
  }

  function recordIssuedSpecialRoom(scheduleState = {}, roomType, depth, source) {
    const next = {
      lastNaturalSpecialDepth: scheduleState.lastNaturalSpecialDepth != null &&
        Number.isFinite(Number(scheduleState.lastNaturalSpecialDepth))
        ? Math.max(0, Math.floor(Number(scheduleState.lastNaturalSpecialDepth)))
        : null,
      lastIssuedDepthByType: {
        ...((scheduleState.lastIssuedDepthByType && typeof scheduleState.lastIssuedDepthByType === "object")
          ? scheduleState.lastIssuedDepthByType
          : {})
      }
    };
    const type = String(roomType || "");
    if (!NATURAL_SPECIAL_ROOM_SOURCES.has(String(source || ""))) return next;
    if (!Object.prototype.hasOwnProperty.call(SPECIAL_ROOM_COOLDOWN_DEPTHS, type)) return next;
    const issuedDepth = Math.max(0, Math.floor(Number(depth) || 0));
    next.lastNaturalSpecialDepth = issuedDepth;
    next.lastIssuedDepthByType[type] = issuedDepth;
    return next;
  }

  function getGuaranteedCampaignRoom(options = {}) {
    const depth = Math.max(0, Math.floor(Number(options.depth) || 0));
    const bossDepth = Boolean(options.bossDepth);
    if (bossDepth) return "";

    const forgeSeenThisGame = Boolean(options.forgeSeenThisGame);
    const forgePityUsedThisGame = Boolean(options.forgePityUsedThisGame);
    if (depth === FORGE_PITY_DEPTH && !forgeSeenThisGame && !forgePityUsedThisGame) {
      return "forge";
    }

    const otterSeenThisGame = Boolean(options.otterSeenThisGame);
    const otterPityUsedThisGame = Boolean(options.otterPityUsedThisGame);
    if (depth === OTTER_PITY_DEPTH && !otterSeenThisGame && !otterPityUsedThisGame) {
      return "otter";
    }

    return "";
  }

  const api = {
    FORGE_PITY_DEPTH,
    OTTER_PITY_DEPTH,
    MERCHANT_FIRST_DEPTH,
    MERCHANT_LAST_DEPTH,
    isScheduledMerchantDepth,
    MERCHANT_FIRST_ROOM_INDEX,
    MERCHANT_LAST_ROOM_INDEX,
    MERCHANT_ROOM_INTERVAL,
    SPECIAL_ROOM_GLOBAL_GAP_DEPTHS,
    SPECIAL_ROOM_COOLDOWN_DEPTHS,
    getGuaranteedCampaignRoom,
    isScheduledMerchantRoom,
    isNaturalSpecialRoomEligible,
    recordIssuedSpecialRoom
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.roomPityApi = api;
  }
})();
