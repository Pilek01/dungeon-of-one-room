const MUTE_AUDIO_SWITCH = "--mute-audio";

function mutedOptions(options = {}) {
  const args = Array.isArray(options.args) ? [...options.args] : [];
  if (!args.includes(MUTE_AUDIO_SWITCH)) args.push(MUTE_AUDIO_SWITCH);
  return { ...options, args };
}

export function launchMutedBrowser(chromium, options = {}) {
  return chromium.launch(mutedOptions(options));
}

export function launchMutedPersistentContext(chromium, profileDir, options = {}) {
  return chromium.launchPersistentContext(profileDir, mutedOptions(options));
}
