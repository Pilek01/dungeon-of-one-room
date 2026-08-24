const DEFAULT_BASE_MAXIMUM = 3;
const MINIMUM_MAXIMUM = 1;
const MAXIMUM_FLASK_STACKS = 5;

function assertObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(code);
  }
  return value;
}

function assertSafeInteger(value, code, minimum = undefined) {
  if (!Number.isSafeInteger(value) || (minimum !== undefined && value < minimum)) {
    throw new TypeError(code);
  }
  return value;
}

function addSafeIntegers(left, right, code) {
  const total = left + right;
  return assertSafeInteger(total, code);
}

function normalizeCapacityInput(input) {
  const source = input === undefined ? {} : assertObject(input, "POTION_CAPACITY_INPUT_INVALID");
  const baseMaximum = source.baseMaximum === undefined ? DEFAULT_BASE_MAXIMUM : source.baseMaximum;
  const satchelLevel = source.satchelLevel === undefined ? 0 : source.satchelLevel;
  const modifierMaximumSlotsAdditive = source.modifierMaximumSlotsAdditive === undefined
    ? 0
    : source.modifierMaximumSlotsAdditive;
  const flaskStacks = source.flaskStacks === undefined ? 0 : source.flaskStacks;
  assertSafeInteger(baseMaximum, "POTION_BASE_MAXIMUM_INVALID", 0);
  assertSafeInteger(satchelLevel, "POTION_SATCHEL_LEVEL_INVALID", 0);
  assertSafeInteger(modifierMaximumSlotsAdditive, "POTION_MODIFIER_CAPACITY_INVALID");
  assertSafeInteger(flaskStacks, "POTION_FLASK_STACKS_INVALID", 0);
  if (flaskStacks > MAXIMUM_FLASK_STACKS) throw new TypeError("POTION_FLASK_STACKS_LIMIT");
  return { baseMaximum, satchelLevel, modifierMaximumSlotsAdditive, flaskStacks };
}

export function derivePotionMaximumV08(input = {}) {
  const normalized = normalizeCapacityInput(input);
  const subtotal = addSafeIntegers(normalized.baseMaximum, normalized.satchelLevel, "POTION_CAPACITY_OVERFLOW");
  const withModifier = addSafeIntegers(subtotal, normalized.modifierMaximumSlotsAdditive, "POTION_CAPACITY_OVERFLOW");
  const total = addSafeIntegers(withModifier, normalized.flaskStacks, "POTION_CAPACITY_OVERFLOW");
  return Math.max(MINIMUM_MAXIMUM, total);
}

export function initializePotionResourcesV08(input = {}) {
  const source = input === undefined ? {} : assertObject(input, "POTION_INITIALIZER_INPUT_INVALID");
  const capacityInput = normalizeCapacityInput(source);
  const startingPotionsAdditive = source.startingPotionsAdditive === undefined ? 0 : source.startingPotionsAdditive;
  assertSafeInteger(startingPotionsAdditive, "POTION_STARTING_GRANT_INVALID", 0);
  const baseAndSatchel = addSafeIntegers(capacityInput.baseMaximum, capacityInput.satchelLevel, "POTION_INITIAL_RESOURCES_OVERFLOW");
  const startingPotions = addSafeIntegers(baseAndSatchel, startingPotionsAdditive, "POTION_INITIAL_RESOURCES_OVERFLOW");
  const maxPotions = derivePotionMaximumV08(capacityInput);
  return { potions: Math.min(maxPotions, startingPotions), maxPotions };
}

export function applyPotionResourceTransitionV08(resources, transition) {
  const current = assertObject(resources, "POTION_RESOURCES_INVALID");
  const requested = assertObject(transition, "POTION_TRANSITION_INVALID");
  assertSafeInteger(current.potions, "POTION_CURRENT_INVALID", 0);
  assertSafeInteger(current.maxPotions, "POTION_MAXIMUM_INVALID", MINIMUM_MAXIMUM);
  const nextMaximum = assertSafeInteger(requested.nextMaximum, "POTION_NEXT_MAXIMUM_INVALID", MINIMUM_MAXIMUM);
  const currentGrant = requested.currentGrant === undefined ? 0 : requested.currentGrant;
  assertSafeInteger(currentGrant, "POTION_CURRENT_GRANT_INVALID");
  const projectedCurrent = addSafeIntegers(current.potions, currentGrant, "POTION_CURRENT_OVERFLOW");
  const next = structuredClone(current);
  next.maxPotions = nextMaximum;
  next.potions = Math.max(0, Math.min(nextMaximum, projectedCurrent));
  return next;
}

export function assertCanonicalPotionResourcesV08(resources, expectedMaximum) {
  const value = assertObject(resources, "POTION_RESOURCES_INVALID");
  assertSafeInteger(expectedMaximum, "POTION_EXPECTED_MAXIMUM_INVALID", MINIMUM_MAXIMUM);
  assertSafeInteger(value.maxPotions, "POTION_MAXIMUM_INVALID", MINIMUM_MAXIMUM);
  if (value.maxPotions !== expectedMaximum) throw new TypeError("POTION_MAXIMUM_MISMATCH");
  assertSafeInteger(value.potions, "POTION_CURRENT_INVALID", 0);
  if (value.potions > value.maxPotions) throw new TypeError("POTION_CURRENT_EXCEEDS_MAXIMUM");
  return value;
}
