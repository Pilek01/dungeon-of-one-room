(function exposeRankedV3Ui(root, factory) {
  "use strict";
  const api = factory(root);
  if (root) root.DungeonRankedV3Ui = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createUiModule(root) {
  "use strict";

  function text(element, value) {
    element.textContent = String(value ?? "");
    return element;
  }

  function createElement(documentRef, tag, className, value = "") {
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    return text(element, value);
  }

  function playerText(value) {
    const clean = String(value || "")
      .replace(/[_-]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    return clean ? `${clean[0].toUpperCase()}${clean.slice(1)}` : "";
  }

  function relicId(choice) {
    return String(choice?.relicId || choice?.publicData?.relicId || choice?.publicData?.id || "");
  }

  function relicDetails(choice) {
    const id = relicId(choice);
    const catalog = root?.DungeonRelicData;
    const relic = Array.isArray(catalog?.RELICS)
      ? catalog.RELICS.find((entry) => entry.id === id)
      : null;
    const rarity = String(relic?.rarity || choice?.publicData?.rarity || "normal").toLowerCase();
    const rarityInfo = catalog?.RARITY?.[rarity] || catalog?.RARITY?.normal || {
      label: "Normal",
      color: "#b0b8c4",
      border: "#b0b8c455",
      bg: "#b0b8c414"
    };
    return id ? {
      id,
      name: String(relic?.name || choice?.name || choice?.label || id),
      description: String(relic?.desc || choice?.description || choice?.publicData?.description || ""),
      icon: String(relic?.icon || relic?.iconSrc || ""),
      rarity,
      rarityInfo
    } : null;
  }

  function createUi(documentRef = globalThis.document) {
    const entry = createElement(documentRef, "button", "ranked-v3-entry", "Ranked (Online)");
    entry.type = "button";
    entry.hidden = true;
    entry.tabIndex = -1;
    entry.setAttribute("aria-label", "Start Ranked (Online). Connection required.");

    const overlay = createElement(documentRef, "section", "ranked-v3-overlay");
    overlay.hidden = true;
    overlay.dataset.view = "message";
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("role", "dialog");
    overlay.addEventListener("pointerdown", (event) => event.stopPropagation());
    overlay.addEventListener("click", (event) => event.stopPropagation());
    overlay.addEventListener("keydown", (event) => event.stopPropagation());
    const card = createElement(documentRef, "div", "ranked-v3-card");
    const eyebrow = createElement(documentRef, "p", "ranked-v3-eyebrow relic-draft-kicker", "Ranked Descent");
    const title = createElement(documentRef, "h2", "ranked-v3-title overlay-title");
    const status = createElement(documentRef, "p", "ranked-v3-status overlay-sub");
    const body = createElement(documentRef, "div", "ranked-v3-body");
    const actions = createElement(documentRef, "div", "ranked-v3-actions");
    card.append(eyebrow, title, status, body, actions);
    overlay.append(card);
    documentRef.body.append(entry, overlay);

    function clear(element) {
      while (element.firstChild) element.removeChild(element.firstChild);
    }

    function setView(view) {
      const normalized = String(view || "message");
      overlay.dataset.view = normalized;
      body.className = normalized === "relic"
        ? "ranked-v3-body relic-draft-panel"
        : "ranked-v3-body";
      card.className = [
        "ranked-v3-card",
        normalized === "relic" ? "ranked-v3-card-relic overlay-card-relic-starting" : "",
        normalized === "leaderboard" ? "ranked-v3-card-leaderboard" : "",
        normalized === "menu" ? "ranked-v3-card-menu" : "",
        normalized === "sync" ? "ranked-v3-card-sync" : ""
      ].filter(Boolean).join(" ");
    }

    function setOpen(open) {
      overlay.hidden = !open;
      const sync = open && overlay.dataset.view === "sync";
      documentRef.body.classList.toggle("ranked-v3-modal-open", open && !sync);
      documentRef.body.classList.toggle("ranked-v3-sync-open", sync);
    }

    function moveActionFocus(offset) {
      const buttons = Array.from(actions.querySelectorAll("button:not(:disabled)"));
      if (!buttons.length) return;
      const currentIndex = buttons.indexOf(documentRef.activeElement);
      const nextIndex = currentIndex < 0
        ? (offset > 0 ? 0 : buttons.length - 1)
        : (currentIndex + offset + buttons.length) % buttons.length;
      const button = buttons[nextIndex];
      button.focus();
    }

    actions.addEventListener("keydown", (event) => {
      if (["ArrowRight", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        moveActionFocus(1);
      } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        moveActionFocus(-1);
      }
    });

    function button(label, onClick, disabled = false) {
      const control = createElement(documentRef, "button", "ranked-v3-button", label);
      control.type = "button";
      control.disabled = disabled;
      control.addEventListener("click", onClick, { once: true });
      return control;
    }

    function showMessage(heading, message, controls = []) {
      setView("message");
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      for (const control of controls) actions.append(control);
      setOpen(true);
      root?.requestAnimationFrame?.(() => actions.querySelector("button:not(:disabled)")?.focus());
    }

    function showMenu(heading, message, controls = []) {
      setView("menu");
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      for (const control of controls) actions.append(control);
      setOpen(true);
      root?.requestAnimationFrame?.(() => actions.querySelector("button:not(:disabled)")?.focus());
    }

    function showSync(message = "Saving progress...") {
      setView("sync");
      text(title, message);
      text(status, "");
      clear(body);
      clear(actions);
      setOpen(true);
    }

    function buildChoice(choice, index, hasRelics, activate) {
      const details = relicDetails(choice);
      const row = createElement(documentRef, "button", "ranked-v3-choice");
      row.type = "button";
      row.dataset.choiceId = String(choice.choiceId || "");
      row.setAttribute("aria-selected", "false");
      if (hasRelics && details) {
        row.className = [
          "ranked-v3-choice",
          "ranked-v3-choice-relic",
          "relic-draft-choice",
          "relic-draft-choice-starting",
          `relic-draft-choice-${details.rarity}`
        ].join(" ");
        row.dataset.relicId = details.id;
        row.style.setProperty("--relic-accent", details.rarityInfo.color);
        row.style.setProperty("--relic-border", details.rarityInfo.border);
        row.style.setProperty("--relic-bg", details.rarityInfo.bg);
        if (details.icon) {
          const icon = createElement(documentRef, "img", "relic-draft-icon");
          icon.src = details.icon;
          icon.alt = "";
          icon.draggable = false;
          row.append(icon);
        }
        row.append(createElement(documentRef, "span", "relic-draft-key", String(index + 1).padStart(2, "0")));
        const copy = createElement(documentRef, "div", "relic-draft-choice-copy");
        copy.append(
          createElement(documentRef, "span", "relic-draft-rarity", String(details.rarityInfo.label || details.rarity)),
          createElement(documentRef, "strong", "", details.name),
          createElement(documentRef, "small", "", details.description)
        );
        row.append(copy);
        row.setAttribute("aria-label", `${details.name}. ${details.description}`);
      } else {
        const name = createElement(documentRef, "strong", "", playerText(choice.name || choice.label || details?.name || "Choice"));
        const description = createElement(
          documentRef,
          "span",
          "",
          playerText(choice.description || choice.publicData?.description || details?.description || "")
        );
        row.append(name, description);
      }
      row.addEventListener("click", () => activate(index));
      return row;
    }

    function showChoices(heading, message, choices, onChoose) {
      const safeChoices = Array.isArray(choices) ? choices : [];
      const hasRelics = safeChoices.some((choice) => relicDetails(choice));
      setView(hasRelics ? "relic" : "choices");
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      const list = createElement(documentRef, "div", "ranked-v3-choice-list");
      if (hasRelics) list.classList.add("relic-draft-grid", "relic-draft-grid-standard");
      let selectedIndex = 0;
      let locked = false;
      const rows = [];
      const select = (index, focus = true) => {
        if (!rows.length) return;
        selectedIndex = (index + rows.length) % rows.length;
        rows.forEach((row, rowIndex) => {
          const selected = rowIndex === selectedIndex;
          row.classList.toggle("hd-nav-selected", selected);
          row.setAttribute("aria-selected", String(selected));
        });
        if (focus) rows[selectedIndex].focus();
      };
      const activate = (index) => {
        if (locked || !rows[index]) return;
        locked = true;
        onChoose(String(safeChoices[index]?.choiceId || ""));
      };
      safeChoices.forEach((choice, index) => {
        const row = buildChoice(choice, index, hasRelics, activate);
        rows.push(row);
        list.append(row);
      });
      list.addEventListener("keydown", (event) => {
        if (["ArrowRight", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          select(selectedIndex + 1);
        } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          select(selectedIndex - 1);
        } else if (["Enter", " "].includes(event.key)) {
          event.preventDefault();
          activate(selectedIndex);
        } else if (/^[1-9]$/u.test(event.key)) {
          const index = Number(event.key) - 1;
          if (rows[index]) {
            event.preventDefault();
            select(index, false);
            activate(index);
          }
        }
      });
      body.append(list);
      setOpen(true);
      select(0, false);
      root?.requestAnimationFrame?.(() => rows[0]?.focus());
    }

    function showContent(heading, message, content, controls = []) {
      const leaderboard = content?.classList?.contains("record-archive-v2");
      setView(leaderboard ? "leaderboard" : "content");
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      if (content) body.append(content);
      for (const control of controls) actions.append(control);
      setOpen(true);
    }

    return Object.freeze({
      entry,
      overlay,
      button,
      setEntryVisible: () => { entry.hidden = true; },
      showMessage,
      showMenu,
      showSync,
      showChoices,
      showContent,
      hide: () => setOpen(false),
      setStatus: (message) => text(status, message)
    });
  }

  return Object.freeze({ createUi, relicDetails, playerText });
});
