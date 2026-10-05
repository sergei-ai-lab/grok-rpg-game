/* Catalog adapter shared by the static Pages game and its tests. */
(() => {
  const STAGES = ["hatchling", "adult", "titan"];
  const FAMILIES = ["fire", "ice", "storm", "shadow", "cosmic", "nature", "crystal", "gold"];
  const RARITIES = ["common", "rare", "epic", "legendary"];
  const STYLES = ["burst", "bulwark", "mend", "burn", "shell", "flurry", "frost", "arc", "leech"];

  function buildRoster(catalog) {
    if (catalog.schemaVersion !== 1 || JSON.stringify(catalog.stageOrder) !== JSON.stringify(STAGES)) {
      throw new Error("Unsupported dragon catalog");
    }
    const ids = new Set();
    const species = [];
    for (const dragon of catalog.dragons) {
      if (!/^[a-z][a-z0-9-]*$/.test(dragon.id) || ids.has(dragon.id) || !FAMILIES.includes(dragon.family) || !RARITIES.includes(dragon.rarity)) {
        throw new Error("Invalid dragon identity");
      }
      ids.add(dragon.id);
      if (dragon.abilities.length !== 2 || !STYLES.includes(dragon.gameplay.style) || !["fury", "ward", "life"].includes(dragon.gameplay.rune)) {
        throw new Error("Invalid dragon abilities");
      }
      // Only complete, correctly named portrait sets can reach any game screen.
      const paths = STAGES.map((stage, i) => {
        const art = dragon.stages[stage]?.art;
        return art?.status === "ready" && art.path === `img/${dragon.id}-${i + 1}.webp` ? art.path : null;
      });
      if (paths.some((path) => !path)) continue;
      const skill = dragon.abilities[1];
      if (!Array.isArray(skill.stageNames) || skill.stageNames.length !== 3) throw new Error("Missing stage skills");
      species.push({ id: dragon.id, name: dragon.name, family: dragon.family, rarity: dragon.rarity,
        element: dragon.gameplay.element, rune: dragon.gameplay.rune, style: dragon.gameplay.style,
        starter: dragon.gameplay.starter === true, unlockAt: dragon.gameplay.unlockAt,
        skills: skill.stageNames, artPaths: paths, blurb: dragon.gameplay.blurb, legend: dragon.legend });
    }
    species.sort((a, b) => {
      const ai = catalog.starterOrder.indexOf(a.id), bi = catalog.starterOrder.indexOf(b.id);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
      return (a.unlockAt ?? Infinity) - (b.unlockAt ?? Infinity);
    });
    if (!species.some((dragon) => dragon.starter)) throw new Error("No starter has a complete portrait set");
    const by = Object.fromEntries(species.map((dragon) => [dragon.id, dragon]));
    const unlockAt = Object.fromEntries(species.filter((dragon) => Number.isInteger(dragon.unlockAt)).map((dragon) => [dragon.unlockAt, dragon.id]));
    return { species, by, unlockAt };
  }

  function artFor(by, id, level) {
    const stage = level >= 10 ? 3 : level >= 5 ? 2 : 1;
    if (!by[id]) throw new Error("Dragon is waiting for its artwork");
    return { src: by[id].artPaths[stage - 1], provisional: false, tint: "", stage };
  }

  function reconcileSave(state, roster) {
    if (!state.partnerId) return state;
    // Keep ownership and progress of hidden dragons so future art restores them.
    state.owned ||= {};
    if (state.parkedPartner && roster.by[state.parkedPartner.id] && state.owned[state.parkedPartner.id]) {
      state.partnerId = state.parkedPartner.id;
      state.partnerName = state.parkedPartner.name;
      delete state.parkedPartner;
    }
    if (!roster.by[state.partnerId]) {
      state.parkedPartner ||= { id: state.partnerId, name: state.partnerName };
      const fallback = roster.species.find((dragon) => state.owned[dragon.id]) || roster.species.find((dragon) => dragon.starter);
      state.partnerId = fallback.id;
      state.partnerName = fallback.name;
      state.owned[fallback.id] ||= { level: 1, xp: 0, rune: fallback.rune, copies: 1 };
    }
    state.squad = [state.partnerId, ...(state.squad || []).filter((id) => id !== state.partnerId && roster.by[id] && state.owned[id])].slice(0, 3);
    return state;
  }

  globalThis.FlockCatalog = Object.freeze({ buildRoster, artFor, reconcileSave });
})();
