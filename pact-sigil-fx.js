(() => {
  function getPactSigilRevealFx() {
    return {
      particles: [
        { color: "#b56cff", count: 16, spread: 1.15 },
        { color: "#ff5ab3", count: 10, spread: 0.9 },
        { color: "#f0dcff", count: 6, spread: 0.65 }
      ],
      rings: [
        { color: "#b56cff", core: "#f3e6ff", maxRadius: 20, life: 280 },
        { color: "#ff76c8", core: "#ffe7f6", maxRadius: 12, life: 200 }
      ],
      shake: 1.6
    };
  }

  const api = {
    getPactSigilRevealFx
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.DungeonPactSigilFx = api;
  }
})();
