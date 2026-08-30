(function exposeRankedV3Session(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRankedV3Session = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createSessionModule() {
  "use strict";

  const STATES = Object.freeze({
    idle: "IDLE",
    starting: "STARTING_RUN",
    startingRelic: "AWAITING_STARTING_RELIC",
    entering: "ENTERING_ROOM",
    active: "ROOM_ACTIVE",
    resolving: "RESOLVING_ROOM",
    offer: "AWAITING_REWARD_OR_TRANSACTION",
    next: "ENTERING_NEXT_ROOM",
    terminal: "TERMINAL_PENDING",
    finalizing: "FINALIZING",
    finalized: "FINALIZED",
    retrying: "RETRYING",
    reconnect: "RECONNECT_REQUIRED",
    protocolError: "UNRECOVERABLE_PROTOCOL_ERROR",
    abandoned: "ABANDONED_LOCAL_SESSION"
  });
  const TRANSITIONS = Object.freeze({
    IDLE: ["STARTING_RUN", "RETRYING"],
    STARTING_RUN: ["AWAITING_STARTING_RELIC", "ENTERING_ROOM", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    AWAITING_STARTING_RELIC: ["ENTERING_ROOM", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    ENTERING_ROOM: ["ROOM_ACTIVE", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    ROOM_ACTIVE: ["RESOLVING_ROOM", "AWAITING_REWARD_OR_TRANSACTION", "TERMINAL_PENDING", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    RESOLVING_ROOM: ["ROOM_ACTIVE", "AWAITING_REWARD_OR_TRANSACTION", "ENTERING_NEXT_ROOM", "TERMINAL_PENDING", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    AWAITING_REWARD_OR_TRANSACTION: ["AWAITING_REWARD_OR_TRANSACTION", "RESOLVING_ROOM", "ENTERING_NEXT_ROOM", "TERMINAL_PENDING", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    ENTERING_NEXT_ROOM: ["ROOM_ACTIVE", "RESOLVING_ROOM", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    TERMINAL_PENDING: ["FINALIZING", "RETRYING", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    FINALIZING: ["FINALIZED", "RETRYING", "RECONNECT_REQUIRED"],
    RETRYING: ["AWAITING_STARTING_RELIC", "ENTERING_ROOM", "ROOM_ACTIVE", "RESOLVING_ROOM", "AWAITING_REWARD_OR_TRANSACTION", "TERMINAL_PENDING", "FINALIZED", "RECONNECT_REQUIRED", "UNRECOVERABLE_PROTOCOL_ERROR"],
    RECONNECT_REQUIRED: ["RETRYING", "ABANDONED_LOCAL_SESSION"],
    UNRECOVERABLE_PROTOCOL_ERROR: ["RETRYING", "ABANDONED_LOCAL_SESSION"],
    FINALIZED: [],
    ABANDONED_LOCAL_SESSION: ["STARTING_RUN", "RETRYING"]
  });

  function createStateMachine(initial = STATES.idle) {
    let state = initial;
    function transition(next) {
      if (!(TRANSITIONS[state] || []).includes(next)) {
        throw new TypeError(`RANKED_STATE_TRANSITION_INVALID:${state}:${next}`);
      }
      state = next;
      return state;
    }
    return Object.freeze({ getState: () => state, transition });
  }

  function isObserverAutomationTransitionState(state, context = {}) {
    if (state === STATES.next && context.canonicalLifeRestartReady === true) return false;
    return state === STATES.entering || state === STATES.next;
  }

  return Object.freeze({ STATES, TRANSITIONS, createStateMachine, isObserverAutomationTransitionState });
});
