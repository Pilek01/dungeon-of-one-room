import { HttpError } from "./errors.js";

export const REQUEST_SCHEMA_POLICY_VERSION = 1;

export const REGISTERED_MUTATION_FIELDS = Object.freeze({
  start: Object.freeze([
    "playerName",
    "season",
    "gameVersion",
    "rulesetId",
    "rulesetHash",
    "clientInstallIdHash",
    "startDepth",
    "profileId",
    "profileCredential",
    "recoveryCredential",
    "clientProtocolVersion",
    "practiceMutatorImport",
    "newCampaign"
  ]),
  bootstrapEvent: Object.freeze([
    "runId",
    "type",
    "bootstrapToken",
    "offerId",
    "choiceId",
    "clientProtocolVersion"
  ]),
  roomEvent: Object.freeze([
    "runId",
    "type",
    "checkpointToken",
    "roomDirectiveId",
    "roomNonce",
    "payload",
    "clientProtocolVersion"
  ]),
  checkpoint: Object.freeze([
    "runId",
    "checkpointToken",
    "roomDirectiveId",
    "roomNonce",
    "roomResult",
    "rewardClaims",
    "turnCount",
    "elapsedMs",
    "commandJournalDigest",
    "compactRoomProof",
    "clientProtocolVersion"
  ]),
  finalize: Object.freeze([
    "runId",
    "checkpointToken",
    "clientProtocolVersion"
  ])
});

export function rejectUnknownRequestFields(body, policyName, errorCode = "REQUEST_FIELDS_INVALID") {
  const allowed = REGISTERED_MUTATION_FIELDS[policyName];
  if (!allowed) throw new TypeError("REQUEST_SCHEMA_POLICY_UNKNOWN");
  const unknown = Object.keys(body).filter((field) => !allowed.includes(field));
  if (unknown.length) {
    throw new HttpError(
      400,
      errorCode,
      `Request fields are invalid for ${policyName}.`
    );
  }
  return body;
}
