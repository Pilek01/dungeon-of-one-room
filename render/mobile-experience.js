(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DungeonMobileExperience = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  // Presentation-only entry latch. It never advances depth or settles rewards.
  function createPortalGate() {
    let seen = null;
    return model => {
      if (!model.onPortal || !model.enabled || model.phase !== 'playing') { seen = null; return false; }
      if (model.blocked) { seen = null; return false; }
      if (model.automated || !model.cleared || model.enemies > 0) return false;
      if (seen === model.location) return false;
      seen = model.location;
      return true;
    };
  }
  function create({read, sendKey, onMenu, onDetails, stopMovement}) {
    const gate = createPortalGate();
    const current = () => {
      const model = read();
      return {...model, blocked: model.blocked || Boolean(document.querySelector('.ranked-v3-overlay:not([hidden])'))};
    };
    const dialog = document.createElement('dialog');
    dialog.id = 'mobileJourneyDialog';
    dialog.className = 'mobile-journey-dialog';
    dialog.setAttribute('aria-labelledby', 'mobileJourneyTitle');
    dialog.setAttribute('aria-describedby', 'mobileJourneyCopy');
    document.body.append(dialog);
    let mode = null;
    let returnFocus = null;
    const button = (action, title, copy = '', tone = '', disabled = false) => `<button type="button" data-journey="${action}" class="journey-choice ${tone}" ${disabled ? 'disabled' : ''}><strong>${title}</strong>${copy ? `<span>${copy}</span>` : ''}</button>`;
    function close() {
      if (dialog.open) dialog.close();
      mode = null;
      document.body.classList.remove('mobile-journey-open');
      document.getElementById('mobileMenuButton')?.setAttribute('aria-expanded', 'false');
      if (returnFocus?.isConnected && returnFocus.getBoundingClientRect().width) returnFocus.focus({preventScroll:true});
    }
    function show(nextMode) {
      const m = current();
      if (!m.enabled || m.phase !== 'playing' || m.blocked) return false;
      if (nextMode === 'portal' && (!m.onPortal || !m.cleared || m.enemies > 0)) return false;
      stopMovement();
      mode = nextMode;
      dialog.dataset.mode = nextMode;
      returnFocus = document.activeElement;
      const portal = mode === 'portal';
      dialog.innerHTML = `<div class="journey-kicker">${portal ? 'The way is open' : `Depth ${Number(m.depth) || 1}`}</div><h2 id="mobileJourneyTitle">${portal ? 'Choose your next step' : 'Take a breath'}</h2><p id="mobileJourneyCopy">${portal ? 'Venture deeper, or bring your earnings back to camp.' : 'Your next turn can wait.'}</p><div class="journey-choices">${portal
        ? button('descend', 'Descend deeper', m.canDescend ? `Enter depth ${m.depth + 1}` : 'Waiting for the next room', 'primary', !m.canDescend) + button('camp', 'Go to camp', 'Finish this run with your earned gold') + button('close', 'Stay in this room')
        : button('close', 'Resume', '', 'primary') + button('stats', 'Player details', 'Build, relics and active effects') + button('fullscreen', 'Full screen', 'More room for the dungeon') + button('retreat', m.cleared ? 'Return to camp' : 'Emergency extract', m.cleared ? 'Finish the run and bank your earnings' : `Review the ${Math.round(m.lossRatio * 100)}% gold cost before leaving`, 'danger') + button('menu', 'Game menu', 'Options and other menu actions')
      }</div><p class="journey-feedback" role="status"></p>`;
      document.body.classList.add('mobile-journey-open');
      document.getElementById('mobileMenuButton')?.setAttribute('aria-expanded', 'true');
      if (!dialog.open) dialog.showModal();
      // Stay/Resume is the safe keyboard default. No automatic room transition.
      dialog.querySelector('[data-journey="close"]')?.focus();
      return true;
    }
    async function fullscreen() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (document.documentElement.requestFullscreen && document.fullscreenEnabled !== false) await document.documentElement.requestFullscreen({navigationUI:'hide'});
        else throw new Error('unsupported');
      } catch {
        if (!dialog.open) show('menu');
        const feedback = dialog.querySelector('.journey-feedback');
        if (feedback) feedback.textContent = 'Full screen is unavailable in this browser. On iPhone, use Share → Add to Home Screen, then launch the game there. You can also keep playing in this tab.';
      }
      syncFullscreen();
    }
    function syncFullscreen() {
      const control = document.getElementById('mobileFullscreenButton');
      if (control) {
        control.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
        control.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
      }
    }
    dialog.addEventListener('click', event => {
      const action = event.target.closest('[data-journey]')?.dataset.journey;
      if (!action) return;
      if (action === 'fullscreen') { fullscreen(); return; }
      const m = current();
      if (m.blocked || m.phase !== 'playing') { close(); return; }
      if ((action === 'descend' || action === 'camp') && (!m.onPortal || !m.cleared || m.enemies > 0)) { close(); return; }
      if (action === 'descend' && !m.canDescend) return;
      close();
      if (action === 'descend') sendKey('e');
      else if (action === 'camp' || action === 'retreat') sendKey('q');
      else if (action === 'menu') onMenu();
      else if (action === 'stats') onDetails();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    // Native dialog supplies focus trapping/inert background; this also blocks
    // game's global keyboard bindings while leaving Tab and button activation.
    window.addEventListener('keydown', event => {
      if (read().enabled && document.body.classList.contains('mobile-details-open')) {
        event.stopImmediatePropagation();
        if (event.key === 'Escape') { event.preventDefault(); document.getElementById('mobileDetailsButton')?.click(); }
        return;
      }
      if (!dialog.open) return;
      event.stopImmediatePropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    }, true);
    window.addEventListener('fullscreenchange', syncFullscreen);
    document.getElementById('mobileFullscreenButton')?.addEventListener('click', fullscreen);
    function sync() {
      const m = current();
      if (dialog.open && (!m.enabled || m.phase !== 'playing' || m.blocked || m.automated)) close();
      if (dialog.open && mode === 'portal') {
        if (!m.onPortal || !m.cleared || m.enemies > 0) close();
        else {
          const descend = dialog.querySelector('[data-journey="descend"]');
          descend.disabled = !m.canDescend;
          descend.querySelector('span').textContent = m.canDescend ? `Enter depth ${m.depth + 1}` : 'Waiting for the next room';
        }
      }
      const interact = document.getElementById('mbtnE');
      if (interact) interact.classList.toggle('is-context-hidden', m.enabled && !m.interactable);
      const fullscreenButton = document.getElementById('mobileFullscreenButton');
      if (fullscreenButton) fullscreenButton.hidden = !m.enabled || m.phase !== 'playing';
      if (m.enabled) {
        const value = document.getElementById('hpRailValue');
        if (value) value.textContent = `${m.hp}/${m.maxHp}`;
        document.getElementById('hpRail')?.setAttribute('aria-label', `Health ${m.hp} of ${m.maxHp}${m.hp / m.maxHp <= .3 ? ', low health' : ''}`);
        document.body.classList.toggle('mobile-low-health', m.hp > 0 && m.hp / m.maxHp <= .3);
      } else document.body.classList.remove('mobile-low-health');
      if (gate(m)) show('portal');
    }
    syncFullscreen();
    // Ranked owns its asynchronous overlays outside the local game's DOM.
    // Recheck presentation when one opens/closes, without sending a request.
    new MutationObserver(records => {
      if (records.some(record => record.target.matches?.('.ranked-v3-overlay'))) sync();
    }).observe(document.body, {subtree:true, attributes:true, attributeFilter:['hidden']});
    return {sync, openMenu:() => show('menu'), openPortal:() => show('portal'), isOpen:() => dialog.open, close};
  }
  return {createPortalGate, create};
});
