"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const session = require("../online-v3/ranked-v3-session.js");

test("blocks Observer automation only while Ranked is entering a room", () => {
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.entering), true);
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.next), true);
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.active), false);
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.offer), false);
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.finalized), false);
});

test("allows Observer automation to start the next canonical life from the death screen", () => {
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.next, {
    canonicalLifeRestartReady: true
  }), false);
  assert.equal(session.isObserverAutomationTransitionState(session.STATES.entering, {
    canonicalLifeRestartReady: true
  }), true);
});
