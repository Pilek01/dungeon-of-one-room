export function isOtterRelicRewardEligibleV08(directive, policy) {
  const depth = Number(directive?.depth);
  return Boolean(
    directive?.roomType === policy?.roomType &&
    directive?.roomCategory === "special" &&
    Number.isSafeInteger(depth) &&
    depth >= policy.minimumDepth &&
    depth <= policy.maximumDepth &&
    depth % policy.excludedBossInterval !== 0
  );
}

export function otterRelicRewardScalingDepthV08(directive) {
  const depth = Math.max(0, Number(directive?.depth) || 0);
  return Math.max(
    depth,
    Math.max(0, Number(directive?.specialRoomPayload?.scalingDepth) || 0)
  );
}
