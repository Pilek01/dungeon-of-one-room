(function exposeRankedV3Ui(root, factory) {
  "use strict";
  const api = factory();
  if (root) root.DungeonRankedV3Ui = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis === "object" ? globalThis : null, function createUiModule() {
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

  function createUi(documentRef = globalThis.document) {
    const entry = createElement(documentRef, "button", "ranked-v3-entry", "Ranked Online v3");
    entry.type = "button";
    entry.hidden = true;
    entry.setAttribute("aria-label", "Start Ranked Online v3. Connection required.");

    const overlay = createElement(documentRef, "section", "ranked-v3-overlay");
    overlay.hidden = true;
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("role", "dialog");
    const card = createElement(documentRef, "div", "ranked-v3-card");
    const title = createElement(documentRef, "h2", "ranked-v3-title");
    const status = createElement(documentRef, "p", "ranked-v3-status");
    const body = createElement(documentRef, "div", "ranked-v3-body");
    const actions = createElement(documentRef, "div", "ranked-v3-actions");
    card.append(title, status, body, actions);
    overlay.append(card);
    documentRef.body.append(entry, overlay);

    function clear(element) {
      while (element.firstChild) element.removeChild(element.firstChild);
    }

    function button(label, onClick, disabled = false) {
      const control = createElement(documentRef, "button", "ranked-v3-button", label);
      control.type = "button";
      control.disabled = disabled;
      control.addEventListener("click", onClick, { once: true });
      return control;
    }

    function showMessage(heading, message, controls = []) {
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      for (const control of controls) actions.append(control);
      overlay.hidden = false;
    }

    function showChoices(heading, message, choices, onChoose) {
      text(title, heading);
      text(status, message);
      clear(body);
      clear(actions);
      const list = createElement(documentRef, "div", "ranked-v3-choice-list");
      for (const choice of choices) {
        const row = createElement(documentRef, "button", "ranked-v3-choice");
        row.type = "button";
        row.dataset.choiceId = String(choice.choiceId || "");
        const name = createElement(documentRef, "strong", "", choice.name || choice.label || choice.relicId || "Choice");
        const description = createElement(
          documentRef,
          "span",
          "",
          choice.description || choice.publicData?.description || ""
        );
        row.append(name, description);
        row.addEventListener("click", () => onChoose(String(choice.choiceId || "")), { once: true });
        list.append(row);
      }
      body.append(list);
      overlay.hidden = false;
    }

    return Object.freeze({
      entry,
      overlay,
      button,
      setEntryVisible: (visible) => { entry.hidden = !visible; },
      showMessage,
      showChoices,
      hide: () => { overlay.hidden = true; },
      setStatus: (message) => text(status, message)
    });
  }

  return Object.freeze({ createUi });
});
