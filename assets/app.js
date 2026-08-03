(function () {
  "use strict";

  const data = window.DRAFT_DASHBOARD_DATA;
  const projections = window.DRAFT_COMPASS_PROJECTIONS || {
    meta: { sourceFileTimestamp: null, sourceRecordCount: 0, sourcePositions: [], matchedBoardRecordCount: 0 },
    players: {}
  };
  const elements = {
    leagueFormat: document.querySelector("#league-format"),
    slot: document.querySelector("#slot"),
    teams: document.querySelector("#teams"),
    flex: document.querySelector("#flex"),
    refreshed: document.querySelector("#data-refreshed"),
    datasetNote: document.querySelector("#dataset-note"),
    provisional: document.querySelector("#provisional-message"),
    draftProfile: document.querySelector("#draft-profile"),
    formatProfile: document.querySelector("#format-profile"),
    leagueModel: document.querySelector("#league-model"),
    nextPick: document.querySelector("#next-pick"),
    nextOverall: document.querySelector("#next-overall"),
    pickMap: document.querySelector("#pick-map"),
    queue: document.querySelector("#draft-queue"),
    rankings: document.querySelector("#rankings-body"),
    sources: document.querySelector("#source-list"),
    search: document.querySelector("#player-search"),
    draftSharksSource: document.querySelector("#draftsharks-source"),
    draftSharksLocalRefresh: document.querySelector("#draftsharks-local-refresh"),
    draftSharksSourceUpdated: document.querySelector("#draftsharks-source-updated"),
    draftSharksStatus: document.querySelector("#draftsharks-status"),
    draftMode: document.querySelector("#draft-mode"),
    mockSeed: document.querySelector("#mock-seed"),
    aiRisk: document.querySelector("#ai-risk"),
    draftStart: document.querySelector("#draft-start"),
    mockNext: document.querySelector("#mock-next"),
    mockRun: document.querySelector("#mock-run"),
    draftUndo: document.querySelector("#draft-undo"),
    draftReset: document.querySelector("#draft-reset"),
    draftStatus: document.querySelector("#draft-status"),
    yourTeam: document.querySelector("#your-team"),
    draftConfigSummary: document.querySelector("#draft-config-summary"),
    draftRoom: document.querySelector("#draft-room"),
    currentPick: document.querySelector("#current-pick"),
    draftPlayerSearch: document.querySelector("#draft-player-search"),
    draftPositionFilter: document.querySelector("#draft-position-filter"),
    draftNeedsOnly: document.querySelector("#draft-needs-only"),
    availablePlayers: document.querySelector("#available-players"),
    draftedBoard: document.querySelector("#drafted-board"),
    userRoster: document.querySelector("#user-roster"),
    managerRosters: document.querySelector("#manager-rosters"),
    priorityPanel: document.querySelector("#priority-panel"),
    conditionalSurvivalNote: document.querySelector("#conditional-survival-note"),
    rosterConstruction: document.querySelector("#roster-construction")
  };

  const draftSharksState = { snapshots: [] };
  const leagueFormats = {
    customHalfPpr: {
      label: "Custom half-PPR",
      scoring: "halfPpr",
      receptionPoints: .5,
      teams: 12,
      flex: 2
    },
    customPpr: {
      label: "Custom full PPR",
      scoring: "ppr",
      receptionPoints: 1,
      teams: 12,
      flex: 2
    }
  };

  const roundNeeds = [
    ["RB", "WR"], ["WR", "RB"], ["RB", "WR"], ["WR", "RB", "TE"], ["RB", "WR"],
    ["WR", "QB", "TE"], ["RB", "WR"], ["WR", "RB"], ["QB", "TE", "WR"], ["RB", "WR"],
    ["WR", "RB", "TE"], ["RB", "WR", "QB"], ["WR", "RB", "TE"], ["RB", "WR", "QB"],
    ["RB", "WR", "TE"]
  ];
  const draftRoomState = {
    picks: [],
    mode: "cheat",
    seed: 2026,
    risk: 50,
    started: false,
    storageMessage: "",
    statusMessage: ""
  };

  const formatDate = (date) => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium", timeStyle: "short"
  }).format(new Date(date));

  const formatPick = (pick, teams) => {
    const round = Math.ceil(pick / teams);
    const inRound = ((pick - 1) % teams) + 1;
    return `${round}.${String(inRound).padStart(2, "0")}`;
  };

  const snakePicks = (teams, slot, rounds) => Array.from({ length: rounds }, (_, index) => {
    const round = index + 1;
    return round % 2 === 1 ? (round - 1) * teams + slot : round * teams - slot + 1;
  });

  const isAdp = (value) => typeof value === "number" && Number.isFinite(value);

  const formatAdp = (value) => isAdp(value) ? value.toFixed(1) : "N/A";

  const formatByeWeek = (player) => Number.isInteger(player.byeWeek) ? `Bye ${player.byeWeek}` : "Bye unavailable";

  const normalizePlayerName = (name) => name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(jr|sr|ii|iii|iv|v|dst)$/, "");

  const draftSharksScoring = (scoring) => scoring === "halfPpr" ? "half-ppr" : "ppr";

  const draftSharksUrl = (state) => `https://www.draftsharks.com/adp/${draftSharksScoring(state.scoring)}/consensus/${state.teams}`;

  const isValidatedSnapshot = (snapshot, state) => {
    if (!snapshot || snapshot.validated !== true || snapshot.scoring !== draftSharksScoring(state.scoring) || Number(snapshot.teams) !== state.teams
      || snapshot.sourceUrl !== draftSharksUrl(state) || !isAdp(Date.parse(snapshot.fetchedAt))
      || (snapshot.sourceUpdatedAt !== null && snapshot.sourceUpdatedAt !== undefined && !isAdp(Date.parse(snapshot.sourceUpdatedAt)))
      || !Array.isArray(snapshot.records) || snapshot.recordCount < 20 || snapshot.records.length < 20) {
      return false;
    }
    const uniquePlayers = new Set(snapshot.records
      .filter((record) => typeof record.player === "string" && isAdp(record.adp) && record.adp > 0)
      .map((record) => normalizePlayerName(record.player)));
    return uniquePlayers.size >= 20;
  };

  const getMarketContext = (state) => {
    const snapshot = draftSharksState.snapshots.find((item) => isValidatedSnapshot(item, state));
    if (!snapshot) {
      return {
        snapshot: null,
        consensusSource: `Local AVG (${data.sources.sleeper.name}/${data.sources.rtSports.name})`,
        values: new Map()
      };
    }
    const values = new Map(snapshot.records
      .filter((record) => typeof record.player === "string" && isAdp(record.adp) && record.adp > 0)
      .map((record) => [normalizePlayerName(record.player), record.adp]));
    return {
      snapshot,
      consensusSource: `DraftSharks ${snapshot.scoring} / ${snapshot.teams}`,
      values
    };
  };

  const consensusAdp = (player, market) => market.values.get(normalizePlayerName(player.name)) ?? player.adp.average;

  const weightedAdp = (player, market) => {
    const yahooWeight = data.sources.yahoo.weight;
    return player.adp.yahoo * yahooWeight + consensusAdp(player, market) * (1 - yahooWeight);
  };

  const targetWindow = (player, market) => {
    if (!isAdp(player.adp.yahoo) || !isAdp(consensusAdp(player, market))) {
      return null;
    }
    const adp = weightedAdp(player, market);
    return {
      adp,
      start: Math.max(1, Math.ceil(adp - 12)),
      preferredStart: Math.max(1, Math.ceil(adp - 8)),
      marketStart: Math.max(1, Math.ceil(adp - 3)),
      end: Math.ceil(adp + 5)
    };
  };

  const clampProbability = (value) => Math.min(1, Math.max(0, value));

  // Deterministic normal approximation: ADP is an expected selection, not a precise outcome.
  const normalCdf = (value) => {
    const absolute = Math.abs(value);
    const t = 1 / (1 + .2316419 * absolute);
    const density = .3989422804014327 * Math.exp(-absolute * absolute / 2);
    const cumulative = 1 - density * t * (.319381530 + t * (-.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return value < 0 ? 1 - cumulative : cumulative;
  };

  const availabilityEstimate = (player, pick, market) => {
    const window = targetWindow(player, market);
    if (!window) {
      return { probability: 0, spread: 0, disagreement: 0 };
    }
    const disagreement = Math.abs(player.adp.yahoo - consensusAdp(player, market));
    const spread = Math.min(30, 1.75 + window.adp * .075 + disagreement * .35);
    return {
      probability: clampProbability(normalCdf((window.adp - (pick - .5)) / spread)),
      spread,
      disagreement
    };
  };

  const nextPickSurvival = (player, pick, nextPick, market) => {
    const current = availabilityEstimate(player, pick, market).probability;
    if (current <= 0 || nextPick <= pick) {
      return 0;
    }
    return clampProbability(availabilityEstimate(player, nextPick, market).probability / current);
  };

  const formatProbability = (value) => `${Math.round(clampProbability(value) * 100)}%`;

  const valueGap = (player, market) => {
    const window = targetWindow(player, market);
    return window ? window.adp - player.rank : 0;
  };

  const captureAction = (player, pick, nextPick, market) => {
    const availability = availabilityEstimate(player, pick, market).probability;
    const survival = nextPickSurvival(player, pick, nextPick, market);
    const guruValue = valueGap(player, market);
    if (availability < .08) {
      return "Value if Falls";
    }
    if ((guruValue >= 18 && survival < .65) || survival < .4) {
      return "Take Now";
    }
    if (availability < .3) {
      return "Value if Falls";
    }
    return "Safe to Wait";
  };

  const isPlausiblyAvailable = (player, pick, market) => availabilityEstimate(player, pick, market).probability >= .08;

  const classify = (player, pick, nextPick, market) => {
    const window = targetWindow(player, market);
    if (!window) {
      return { label: "Avoid", className: "avoid", detail: "missing Yahoo or source AVG" };
    }
    const { adp } = window;
    const earlyBy = Math.round(adp - pick);
    const lateBy = Math.round(pick - adp);
    const guruValue = Math.round(valueGap(player, market));
    const action = captureAction(player, pick, nextPick, market);

    if (earlyBy > 12) {
      return { label: "Avoid", className: "avoid", detail: `${earlyBy} early exceeds guardrail` };
    }
    if (lateBy >= 9) {
      return { label: "Major steal", className: "major-steal", detail: `${lateBy} past market` };
    }
    if (earlyBy >= 9) {
      if (player.tier <= 2 || (guruValue >= 18 && action === "Take Now")) {
        return { label: "High priority", className: "high-priority", detail: `${earlyBy} early: controlled reach` };
      }
      return { label: "Avoid", className: "avoid", detail: `${earlyBy} early without value case` };
    }
    if (earlyBy >= 4 || lateBy >= 4) {
      return { label: "High priority", className: "high-priority", detail: earlyBy >= 4 ? `${earlyBy} early: preferred` : `${lateBy} past market` };
    }
    return { label: "Fair", className: "fair", detail: earlyBy > 0 ? `${earlyBy} early: market range` : "at market" };
  };

  const preferredPositionScore = (player, round, flexSlots) => {
    const wanted = roundNeeds[round - 1] || ["RB", "WR"];
    const positionIndex = wanted.indexOf(player.position);
    const flexBonus = flexSlots === 2 && ["RB", "WR", "TE"].includes(player.position) ? 2 : 0;
    return positionIndex === -1 ? 0 : (wanted.length - positionIndex) * 4 + flexBonus;
  };

  const getState = () => {
    const format = leagueFormats[elements.leagueFormat.value];
    return {
    format: elements.leagueFormat.value,
    scoring: format.scoring,
    receptionPoints: format.receptionPoints,
    formatLabel: format.label,
    teams: Number(elements.teams.value),
    slot: Number(elements.slot.value),
    flex: Number(elements.flex.value)
    };
  };

  const getPlayers = (scoring) => data.rankings[scoring].items;

  const starterCounts = { QB: 1, RB: 2, WR: 2, TE: 1 };
  const flexPositions = new Set(["RB", "WR", "TE"]);

  const projectedPoints = (player, state) => {
    const stats = projections && projections.players[player.id];
    if (!stats) {
      return null;
    }
    return stats.passYards / 25 + stats.passTouchdowns * 6 - stats.interceptions * 2
      + stats.rushYards / 10 + stats.rushTouchdowns * 6
      + stats.receptions * state.receptionPoints + stats.receivingYards / 10
      + stats.receivingTouchdowns * 6 - stats.fumbles * 2;
  };

  const createScarcityModel = (players, state, market) => {
    const leagueWideStarterCounts = Object.fromEntries(Object.entries(starterCounts).map(([position, count]) => [
      position, count * state.teams
    ]));
    const byPosition = Object.fromEntries(["QB", "RB", "WR", "TE"].map((position) => [
      position, players.filter((player) => player.position === position).sort((left, right) => left.rank - right.rank)
    ]));
    const flexPool = ["RB", "WR", "TE"].flatMap((position) =>
      byPosition[position].slice(leagueWideStarterCounts[position])
    ).sort((left, right) => left.rank - right.rank).slice(0, state.teams * state.flex);
    const flexAllocation = Object.fromEntries(["RB", "WR", "TE"].map((position) => [
      position, flexPool.filter((player) => player.position === position).length
    ]));
    const replacementIndex = {
      QB: leagueWideStarterCounts.QB + 1,
      RB: leagueWideStarterCounts.RB + flexAllocation.RB + 1,
      WR: leagueWideStarterCounts.WR + flexAllocation.WR + 1,
      TE: leagueWideStarterCounts.TE + flexAllocation.TE + 1
    };
    const replacements = Object.fromEntries(Object.entries(byPosition).map(([position, ranked]) => [
      position, ranked[replacementIndex[position] - 1] || null
    ]));
    const positionalTier = new Map();
    Object.entries(byPosition).forEach(([position, ranked]) => ranked.forEach((player, index) => {
      positionalTier.set(player.id, 1 + Math.floor(index / 6));
    }));
    const projectionById = new Map(players.map((player) => [player.id, projectedPoints(player, state)]));
    const projectionReplacementPlayer = {};
    const projectionReplacement = Object.fromEntries(Object.entries(byPosition).map(([position, ranked]) => {
      const projected = ranked
        .map((player) => ({ player, points: projectionById.get(player.id) }))
        .filter(({ points }) => isAdp(points))
        .sort((left, right) => right.points - left.points);
      const baseline = projected[replacementIndex[position] - 1];
      projectionReplacementPlayer[position] = baseline ? baseline.player : null;
      return [position, baseline ? baseline.points : null];
    }));
    const vorp = new Map(players.map((player) => {
      const points = projectionById.get(player.id);
      const baseline = projectionReplacement[player.position];
      return [player.id, isAdp(points) && isAdp(baseline) ? points - baseline : null];
    }));
    return {
      byPosition,
      flexAllocation,
      replacementIndex,
      replacements,
      positionalTier,
      projectionById,
      projectionReplacement,
      projectionReplacementPlayer,
      vorp
    };
  };

  const tierDropBeforeNextPick = (player, nextPick, market, scarcity) => {
    const currentTier = scarcity.positionalTier.get(player.id);
    const positionPlayers = scarcity.byPosition[player.position];
    if (!positionPlayers) {
      return { label: "No QB/RB/WR/TE tier", tierDelta: 0, projectionDrop: null };
    }
    const fallback = positionPlayers.find((candidate) =>
      candidate.rank > player.rank && availabilityEstimate(candidate, nextPick, market).probability >= .08
    );
    if (!fallback) {
      return { label: `Tier ${currentTier} exhausted`, tierDelta: 1, projectionDrop: null };
    }
    const fallbackTier = scarcity.positionalTier.get(fallback.id);
    const points = scarcity.projectionById.get(player.id);
    const fallbackPoints = scarcity.projectionById.get(fallback.id);
    const projectionDrop = isAdp(points) && isAdp(fallbackPoints) ? Math.max(0, points - fallbackPoints) : null;
    return {
      label: `Tier ${currentTier} -> ${fallbackTier}`,
      tierDelta: Math.max(0, fallbackTier - currentTier),
      projectionDrop
    };
  };

  const rosterNeed = (player, roster) => {
    const count = roster[player.position] || 0;
    if (starterCounts[player.position] && count < starterCounts[player.position]) {
      return "Core need";
    }
    const flexFilled = Math.max(0, roster.RB - starterCounts.RB)
      + Math.max(0, roster.WR - starterCounts.WR) + Math.max(0, roster.TE - starterCounts.TE);
    if (flexPositions.has(player.position) && flexFilled < 2) {
      return "Flex need";
    }
    return "Depth";
  };

  const scarcityAction = (player, pick, nextPick, market, scarcity, roster, marketAction) => {
    const need = rosterNeed(player, roster);
    const drop = tierDropBeforeNextPick(player, nextPick, market, scarcity);
    const survival = nextPickSurvival(player, pick, nextPick, market);
    if (need === "Depth" && marketAction !== "Take Now") {
      return { action: "Pivot", need, drop };
    }
    if (marketAction === "Take Now" || (need !== "Depth" && (drop.tierDelta > 0 || survival < .65))) {
      return { action: "Take Now", need, drop };
    }
    if (survival >= .65) {
      return { action: "Wait", need, drop };
    }
    return { action: "Take Now", need, drop };
  };

  const formatPoints = (points) => isAdp(points) ? `${points.toFixed(1)} pts` : "Projection unavailable";

  const renderLeagueModel = (state, scarcity) => {
    const entries = ["QB", "RB", "WR", "TE"].map((position) => {
      const replacement = scarcity.projectionReplacementPlayer[position] || scarcity.replacements[position];
      const projectedBaseline = scarcity.projectionReplacement[position];
      const flexLabel = flexPositions.has(position) ? ` + ${scarcity.flexAllocation[position]} flex` : "";
      const projectionLabel = isAdp(projectedBaseline)
        ? `Projected replacement VORP baseline ${projectedBaseline.toFixed(1)} pts`
        : "Projection VORP unavailable: no matched source projection depth";
      const replacementLabel = isAdp(projectedBaseline) ? `projected ${position}` : position;
      return `<div><span>${position} replacement</span><strong>${replacement ? `${replacementLabel}${scarcity.replacementIndex[position]}: ${replacement.name}` : "Unavailable"}</strong><span>${projectionLabel}${flexLabel}</span></div>`;
    });
    const sourceTimestamp = projections && projections.meta ? formatDate(projections.meta.sourceFileTimestamp) : "Unavailable";
    entries.push(`<div><span>Projection source</span><strong>${projections.meta.matchedBoardRecordCount}/${data.meta.sourceRecordCount} board matches</strong><span>${projections.meta.sourcePositions.join(", ")} only · file timestamp ${sourceTimestamp}</span></div>`);
    entries.push(`<div><span>Scoring coverage</span><strong>${state.formatLabel}</strong><span>Full PPR adds 0.5 per reception versus half-PPR. First-down and game bonus points are excluded.</span></div>`);
    elements.leagueModel.innerHTML = entries.join("");
  };

  const draftStorageKey = (state) => `draft-compass-live-v1:${state.format}:${state.teams}:${state.slot}:${state.flex}`;

  const pickOwner = (overallPick, teams) => {
    const inRound = ((overallPick - 1) % teams) + 1;
    const round = Math.ceil(overallPick / teams);
    return round % 2 === 1 ? inRound : teams - inRound + 1;
  };

  const createRosters = (teams, picks) => Array.from({ length: teams }, (_, index) => ({
    team: index + 1,
    players: picks.filter((pick) => pick.team === index + 1).map((pick) => pick.playerId)
  }));

  const rosterCounts = (roster, playerById) => roster.players.reduce((counts, id) => {
    const player = playerById.get(id);
    if (player) {
      counts[player.position] = (counts[player.position] || 0) + 1;
    }
    return counts;
  }, { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 });

  const getCurrentOverallPick = () => draftRoomState.picks.length + 1;

  const getNextUserOverallPick = (state, startPick = getCurrentOverallPick()) => {
    for (let pick = startPick; pick <= state.teams * 15; pick += 1) {
      if (pickOwner(pick, state.teams) === state.slot) {
        return pick;
      }
    }
    return null;
  };

  const conditionalSurvivalEstimate = (player, state, market, scarcity, rosters, currentPick, playerById) => {
    const nextUserPick = getNextUserOverallPick(state, currentPick + 1);
    const baseline = nextUserPick ? nextPickSurvival(player, currentPick, nextUserPick, market) : 0;
    if (!nextUserPick || nextUserPick <= currentPick) {
      return { probability: 0, baseline, ahead: 0, needs: 0, tierPressure: 0, detail: "No future user pick in this 15-round room." };
    }
    const ownersAhead = [];
    for (let pick = currentPick + 1; pick < nextUserPick; pick += 1) {
      const owner = pickOwner(pick, state.teams);
      if (owner !== state.slot) {
        ownersAhead.push(owner);
      }
    }
    const uniqueOwners = [...new Set(ownersAhead)];
    const tier = scarcity.positionalTier.get(player.id);
    const needs = uniqueOwners.filter((team) => {
      const counts = rosterCounts(rosters[team - 1], playerById);
      return rosterNeed(player, counts) !== "Depth";
    }).length;
    const tierPressure = uniqueOwners.filter((team) => {
      const roster = rosters[team - 1];
      return roster.players.some((id) => scarcity.positionalTier.get(id) === tier);
    }).length;
    const needRate = uniqueOwners.length ? needs / uniqueOwners.length : 0;
    const runRate = uniqueOwners.length ? tierPressure / uniqueOwners.length : 0;
    const adjustment = .32 * needRate + .12 * runRate;
    const probability = clampProbability(Math.min(.97, baseline * (1 - adjustment) + (needs === 0 ? (1 - baseline) * .12 : 0)));
    return {
      probability,
      baseline,
      ahead: uniqueOwners.length,
      needs,
      tierPressure,
      detail: `${uniqueOwners.length} teams ahead; ${needs} need ${player.position}; ${tierPressure} already hold Tier ${tier}; model estimate.`
    };
  };

  const deterministicRandom = (seed) => {
    let value = (seed >>> 0) || 1;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  };

  const getDraftCandidates = (players, state, market, scarcity, rosters, currentPick, analysisTeam = state.slot) => {
    const drafted = new Set(draftRoomState.picks.map((pick) => pick.playerId));
    const playerById = new Map(players.map((player) => [player.id, player]));
    const nextUserPick = getNextUserOverallPick(state, currentPick + 1) || currentPick + state.teams;
    const counts = rosterCounts(rosters[analysisTeam - 1], playerById);
    return players
      .filter((player) => !drafted.has(player.id) && targetWindow(player, market))
      .map((player) => {
        const status = classify(player, currentPick, nextUserPick, market);
        const availability = availabilityEstimate(player, currentPick, market).probability;
        const marketAction = captureAction(player, currentPick, nextUserPick, market);
        const gameTheory = scarcityAction(player, currentPick, nextUserPick, market, scarcity, counts, marketAction);
        const conditional = conditionalSurvivalEstimate(player, state, market, scarcity, rosters, currentPick, playerById);
        const tier = scarcity.positionalTier.get(player.id) || 99;
        const needWeight = gameTheory.need === "Core need" ? 12 : gameTheory.need === "Flex need" ? 6 : 0;
        const score = (220 - player.rank) + needWeight + Math.max(0, valueGap(player, market)) * .2
          + (gameTheory.drop.tierDelta * 5) + (1 - conditional.probability) * 8 - Math.abs(weightedAdp(player, market) - currentPick) * .4;
        return {
          player,
          status,
          availability,
          conditional,
          gameTheory,
          tier,
          vorp: scarcity.vorp.get(player.id),
          projection: projectedPoints(player, state),
          score
        };
      })
      .filter((candidate) => candidate.status.className !== "avoid" && candidate.availability >= .03)
      .sort((left, right) => right.score - left.score);
  };

  const saveLiveDraft = (state) => {
    if (draftRoomState.mode !== "live") {
      return true;
    }
    try {
      localStorage.setItem(draftStorageKey(state), JSON.stringify({
        picks: draftRoomState.picks,
        started: draftRoomState.started
      }));
      draftRoomState.storageMessage = "";
      return true;
    } catch (error) {
      draftRoomState.storageMessage = "Browser storage is unavailable; this Live Draft will remain only while this page stays open.";
      return false;
    }
  };

  const loadLiveDraft = (state) => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftStorageKey(state)) || "null");
      const picks = saved && saved.picks;
      const validPicks = Array.isArray(picks)
        && picks.every((pick) => pick
          && typeof pick.playerId === "string"
          && Number.isInteger(pick.team)
          && pick.team >= 1
          && pick.team <= state.teams)
        && new Set(picks.map((pick) => pick.playerId)).size === picks.length;
      draftRoomState.picks = validPicks ? picks : [];
      draftRoomState.started = validPicks && (saved.started === true || picks.length > 0);
      draftRoomState.storageMessage = validPicks || picks == null
        ? ""
        : "Saved Live Draft data was invalid for these settings, so a new board was started.";
    } catch (error) {
      draftRoomState.picks = [];
      draftRoomState.started = false;
      draftRoomState.storageMessage = "Saved Live Draft data could not be restored, so a new board was started.";
    }
  };

  const clearLiveDraft = (state) => {
    if (draftRoomState.mode !== "live") {
      return true;
    }
    try {
      localStorage.removeItem(draftStorageKey(state));
      draftRoomState.storageMessage = "";
      return true;
    } catch (error) {
      draftRoomState.storageMessage = "Browser storage could not be cleared; the in-memory draft board was reset.";
      return false;
    }
  };

  const addDraftPick = (playerId, state, assignedTeam) => {
    const currentPick = getCurrentOverallPick();
    if (!draftRoomState.started || currentPick > state.teams * 15 || draftRoomState.picks.some((pick) => pick.playerId === playerId)) {
      return false;
    }
    draftRoomState.picks.push({ playerId, team: assignedTeam || pickOwner(currentPick, state.teams) });
    saveLiveDraft(state);
    return true;
  };

  const chooseMockPlayer = (players, state, market, scarcity, rosters, currentPick) => {
    const candidates = getDraftCandidates(
      players,
      state,
      market,
      scarcity,
      rosters,
      currentPick,
      pickOwner(currentPick, state.teams)
    ).slice(0, 18);
    if (!candidates.length) {
      return null;
    }
    const random = deterministicRandom(draftRoomState.seed + currentPick * 7919);
    const risk = Number(elements.aiRisk.value) / 100;
    const weighted = candidates.map((candidate, index) => ({
      candidate,
      weight: Math.max(.05, (18 - index) * (1 - risk * .45) + random() * (1 + risk * 8))
    }));
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let threshold = random() * total;
    for (const item of weighted) {
      threshold -= item.weight;
      if (threshold <= 0) {
        return item.candidate.player;
      }
    }
    return weighted[0].candidate.player;
  };

  const playMockUntilUser = (players, state, market, scarcity, stopAfterOne = false) => {
    while (getCurrentOverallPick() <= state.teams * 15 && pickOwner(getCurrentOverallPick(), state.teams) !== state.slot) {
      const rosters = createRosters(state.teams, draftRoomState.picks);
      const player = chooseMockPlayer(players, state, market, scarcity, rosters, getCurrentOverallPick());
      if (!player || !addDraftPick(player.id, state, pickOwner(getCurrentOverallPick(), state.teams))) {
        break;
      }
      if (stopAfterOne) {
        break;
      }
    }
  };

  const renderRosters = (players, state) => {
    const playerById = new Map(players.map((player) => [player.id, player]));
    const rosters = createRosters(state.teams, draftRoomState.picks);
    const renderRoster = (roster) => {
      const grouped = ["QB", "RB", "WR", "TE", "K", "DST"].map((position) => {
        const names = roster.players.map((id) => playerById.get(id))
          .filter((player) => player && player.position === position)
          .map((player) => `${player.name} (${formatByeWeek(player)})`);
        return names.length ? `<li><strong>${position}</strong>: ${names.join(", ")}</li>` : "";
      }).join("");
      return `<ul class="roster-list">${grouped || "<li>No players drafted</li>"}</ul>`;
    };
    const userRoster = rosters[state.slot - 1];
    elements.userRoster.innerHTML = `<h3>Your Team ${state.slot}</h3>${renderRoster(userRoster)}`;
    elements.managerRosters.innerHTML = rosters.map((roster) =>
      `<article class="${roster.team === state.slot ? "user-manager" : ""}"><h3>Team ${roster.team}${roster.team === state.slot ? " (you)" : ""}</h3>${renderRoster(roster)}</article>`
    ).join("");
    return rosters;
  };

  const byeWeekInsight = (roster, playerById) => {
    const weeks = new Map();
    let unavailable = 0;
    roster.players.forEach((id) => {
      const player = playerById.get(id);
      if (!player || !Number.isInteger(player.byeWeek)) {
        unavailable += 1;
        return;
      }
      weeks.set(player.byeWeek, (weeks.get(player.byeWeek) || 0) + 1);
    });
    const concentration = [...weeks.entries()]
      .sort(([left], [right]) => left - right)
      .map(([week, count]) => `Week ${week}: ${count}`)
      .join(" · ");
    return `${concentration || "No sourced bye weeks on roster yet."}${unavailable ? ` · ${unavailable} bye unavailable` : ""} Informational only; no hard veto.`;
  };

  const renderRosterConstruction = (state, rosters, playerById) => {
    const counts = rosterCounts(rosters[state.slot - 1], playerById);
    const required = { QB: 1, RB: 2, WR: 2, TE: 1 };
    const coreFilled = Object.entries(required).reduce((total, [position, target]) =>
      total + Math.min(target, counts[position]), 0);
    const flexEligible = counts.RB + counts.WR + counts.TE;
    const flexFilled = Math.min(state.flex, Math.max(0, flexEligible - (required.RB + required.WR + required.TE)));
    const roles = Object.entries(required).map(([position, target]) => {
      const count = counts[position];
      const stateLabel = count >= target ? "filled" : count ? "in-progress" : "open";
      return `<div class="roster-slot ${stateLabel}"><span>${position}</span><strong>${Math.min(count, target)}/${target}</strong></div>`;
    });
    roles.push(`<div class="roster-slot ${flexFilled >= state.flex ? "filled" : flexFilled ? "in-progress" : "open"}"><span>FLEX</span><strong>${flexFilled}/${state.flex}</strong></div>`);
    elements.rosterConstruction.innerHTML = `
      <div class="roster-slots">${roles.join("")}</div>
      <p>${coreFilled + flexFilled}/${Object.values(required).reduce((sum, value) => sum + value, 0) + state.flex} starter/flex spots filled. K and DEF stay outside the scarcity model.</p>
      <p class="bye-insight"><strong>Bye-week roster view:</strong> ${byeWeekInsight(rosters[state.slot - 1], playerById)}</p>`;
  };

  const renderPriorityPanel = (players, state, market, scarcity, rosters, currentPick) => {
    if (currentPick > state.teams * 15) {
      elements.priorityPanel.innerHTML = "<p>Draft room complete through Round 15.</p>";
      return;
    }
    const candidates = getDraftCandidates(players, state, market, scarcity, rosters, currentPick).slice(0, 4);
    if (!candidates.length) {
      elements.priorityPanel.innerHTML = "<p>No eligible target remains in the current source-backed board.</p>";
      return;
    }
    const primary = candidates[0];
    const { player, gameTheory, conditional, tier, vorp, availability } = primary;
    elements.priorityPanel.innerHTML = `
      <article class="primary-recommendation">
        <span class="recommendation-action">${gameTheory.action}</span>
        <strong>${player.name} <small>${player.position} · Tier ${tier} · ${formatByeWeek(player)}</small></strong>
        <p>${gameTheory.need}; ${gameTheory.drop.label}. ${conditional.detail}</p>
        <dl class="recommendation-metrics">
          <div><dt>Available now</dt><dd>${formatProbability(availability)}</dd></div>
          <div><dt>Next-pick survival</dt><dd>${formatProbability(conditional.probability)}</dd></div>
          <div><dt>VORP</dt><dd>${isAdp(vorp) ? vorp.toFixed(1) : "N/A"}</dd></div>
          <div><dt>Market ADP</dt><dd>${formatAdp(weightedAdp(player, market))}</dd></div>
        </dl>
      </article>
      <div class="recommendation-alternatives">
        <h3>Alternatives</h3>
        ${candidates.slice(1).map((candidate, index) => `<article class="priority-card">
          <span>${candidate.gameTheory.action} · Tier ${candidate.tier}</span>
          <strong>${index + 1}. ${candidate.player.name} <small>${candidate.player.position} · ${formatByeWeek(candidate.player)}</small></strong>
          <span>${candidate.gameTheory.need}; ${candidate.gameTheory.drop.label}; ${formatProbability(candidate.conditional.probability)} next-pick survival.</span>
        </article>`).join("")}
      </div>`;
    elements.conditionalSurvivalNote.textContent = `${primary.player.name}: ${primary.conditional.detail} Baseline ADP survival ${formatProbability(primary.conditional.baseline)}; adjusted ${formatProbability(primary.conditional.probability)}. Model estimate, not certainty.`;
  };

  const renderDraftConfiguration = (state) => {
    const picks = snakePicks(state.teams, state.slot, 15);
    elements.yourTeam.textContent = `Your team: pick ${state.slot} (Team ${state.slot})`;
    elements.draftConfigSummary.textContent = `${state.formatLabel} · ${state.teams} teams · ${state.flex} flex · scheduled picks ${picks.slice(0, 3).map((pick) => formatPick(pick, state.teams)).join(", ")}${picks.length > 3 ? "…" : ""}`;
  };

  const setDraftSettingsLocked = (locked) => {
    [
      elements.leagueFormat,
      elements.slot,
      elements.teams,
      elements.flex,
      elements.draftMode,
      elements.mockSeed,
      elements.aiRisk
    ].forEach((control) => {
      control.disabled = locked;
    });
  };

  const renderDraftRoom = (players, state, market, scarcity) => {
    const mode = elements.draftMode.value;
    draftRoomState.mode = mode;
    elements.draftRoom.hidden = mode === "cheat";
    renderDraftConfiguration(state);
    setDraftSettingsLocked(mode !== "cheat" && draftRoomState.started);
    elements.draftStart.hidden = mode === "cheat";
    elements.draftStart.disabled = mode === "cheat" || draftRoomState.started;
    elements.draftStart.textContent = mode === "mock" ? "Start Mock Draft" : "Start Live Draft";
    elements.mockNext.disabled = mode !== "mock" || !draftRoomState.started;
    elements.mockRun.disabled = mode !== "mock" || !draftRoomState.started;
    elements.draftUndo.disabled = mode === "cheat" || !draftRoomState.started || draftRoomState.picks.length === 0;
    elements.draftReset.disabled = mode === "cheat";
    if (mode === "cheat") {
      elements.draftStatus.textContent = "Cheat Sheet mode leaves the offline draft board inactive.";
      return;
    }
    const currentPick = getCurrentOverallPick();
    const rosters = renderRosters(players, state);
    const playerById = new Map(players.map((player) => [player.id, player]));
    renderRosterConstruction(state, rosters, playerById);
    if (!draftRoomState.started) {
      elements.currentPick.textContent = `Ready at Overall 1 (${formatPick(1, state.teams)}) · Snake Team 1`;
      elements.draftStatus.textContent = mode === "mock"
        ? "Settings are editable. Start Mock Draft to auto-run AI picks until your first turn."
        : "Settings are editable. Start Live Draft to begin at pick 1; every team remains a manual active pick.";
    } else if (currentPick > state.teams * 15) {
      elements.currentPick.textContent = "Draft complete through Round 15.";
      elements.draftStatus.textContent = `${mode === "mock" ? "Mock" : "Live"} draft complete.`;
    } else {
      const owner = pickOwner(currentPick, state.teams);
      const userTurn = owner === state.slot;
      elements.currentPick.textContent = `Overall ${currentPick} (${formatPick(currentPick, state.teams)}) · Snake Team ${owner}${userTurn ? " — your turn" : ""}`;
      elements.draftStatus.textContent = mode === "mock"
        ? (userTurn ? "Your mock pick: click an available player." : "AI turn: play next or auto-run to your pick.")
        : `Live offline pick ${currentPick}: click a player to assign to the snake owner or selected team.`;
    }
    if (draftRoomState.storageMessage) {
      elements.draftStatus.textContent += ` ${draftRoomState.storageMessage}`;
    }
    if (draftRoomState.statusMessage) {
      elements.draftStatus.textContent += ` ${draftRoomState.statusMessage}`;
    }
    const query = elements.draftPlayerSearch.value.trim().toLowerCase();
    const position = elements.draftPositionFilter.value;
    const needsOnly = elements.draftNeedsOnly.checked;
    const candidates = getDraftCandidates(players, state, market, scarcity, rosters, currentPick)
      .filter(({ player }) => `${player.name} ${player.position} ${player.team} ${formatByeWeek(player)}`.toLowerCase().includes(query))
      .filter((candidate) => position === "all" || candidate.player.position === position)
      .filter((candidate) => !needsOnly || candidate.gameTheory.need !== "Depth")
      .slice(0, 60);
    const canPick = draftRoomState.started && (mode === "live" || (mode === "mock" && currentPick <= state.teams * 15 && pickOwner(currentPick, state.teams) === state.slot));
    elements.availablePlayers.innerHTML = candidates.map((candidate) => `
      <article class="available-player">
        <span><strong>${candidate.player.name} · ${candidate.player.position}</strong><small>${formatByeWeek(candidate.player)} · Tier ${candidate.tier} · ${candidate.gameTheory.action} · ${formatProbability(candidate.availability)} available now · ${candidate.gameTheory.need}</small></span>
        <button type="button" data-draft-player="${candidate.player.id}" ${canPick ? "" : "disabled"}>Draft now</button>
      </article>`).join("") || "<p class=\"queue-fallback\">No matching available players.</p>";
    elements.draftedBoard.innerHTML = draftRoomState.picks.map((pick, index) => {
      const player = playerById.get(pick.playerId);
      const owner = pickOwner(index + 1, state.teams);
      const yourPick = owner === state.slot ? " your-pick" : "";
      return `<li class="${yourPick.trim()}"><span><strong>${index + 1}. ${player ? player.name : pick.playerId}</strong><small>Team ${pick.team} · ${player ? `${player.position} · ${formatByeWeek(player)}` : "unknown"}</small></span></li>`;
    }).join("") || "<li>No picks yet.</li>";
    renderPriorityPanel(players, state, market, scarcity, rosters, currentPick);
  };

  const formatSnapshotDate = (date) => isAdp(Date.parse(date)) ? formatDate(date) : "unknown time";

  const renderDraftSharks = (state, market) => {
    const sourceUrl = draftSharksUrl(state);
    elements.draftSharksSource.href = sourceUrl;
    elements.draftSharksSource.textContent = `Open DraftSharks ${state.scoring === "halfPpr" ? "half-PPR" : "PPR"} ${state.teams}-team source`;

    if (market.snapshot) {
      elements.draftSharksLocalRefresh.textContent = `${formatSnapshotDate(market.snapshot.fetchedAt)} (${market.snapshot.recordCount} validated records)`;
      elements.draftSharksSourceUpdated.textContent = market.snapshot.sourceUpdatedAt
        ? formatSnapshotDate(market.snapshot.sourceUpdatedAt)
        : "Source timestamp unavailable in the validated public response.";
      elements.draftSharksStatus.textContent = `Consensus ADP: ${market.consensusSource}, refreshed ${formatSnapshotDate(market.snapshot.fetchedAt)} (${market.snapshot.recordCount} validated records). It changes market ADP only; Guru rankings remain unchanged. Players absent from the snapshot use local AVG.`;
    } else {
      elements.draftSharksLocalRefresh.textContent = `No matching snapshot; local board refreshed ${formatDate(data.meta.dataLastRefreshed)}.`;
      elements.draftSharksSourceUpdated.textContent = "Source timestamp unavailable because no matching validated snapshot is saved.";
      elements.draftSharksStatus.textContent = `Consensus ADP: ${market.consensusSource}, refreshed ${formatDate(data.meta.dataLastRefreshed)}. No validated DraftSharks ${state.scoring === "halfPpr" ? "half-PPR" : "PPR"} / ${state.teams}-team snapshot is saved; the queue uses local AVG.`;
    }
  };

  const loadDraftSharksSnapshots = async () => {
    try {
      const response = await fetch(`data/draftsharks-snapshots.json?cache=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload.snapshots)) {
        throw new Error("invalid snapshot payload");
      }
      draftSharksState.snapshots = payload.snapshots;
    } catch (error) {
      elements.draftSharksStatus.textContent = "DraftSharks snapshot metadata could not be loaded. The local Yahoo-primary board is unaffected; open the source or run the guarded refresh workflow.";
    }
    render();
  };

  const renderSlots = () => {
    const teams = Number(elements.teams.value);
    const selected = Math.min(Number(elements.slot.value) || 1, teams);
    elements.slot.replaceChildren(...Array.from({ length: teams }, (_, index) => {
      const option = document.createElement("option");
      option.value = String(index + 1);
      option.textContent = `Slot ${index + 1} of ${teams}`;
      option.selected = index + 1 === selected;
      return option;
    }));
  };

  const renderMeta = (state, market) => {
    const board = data.rankings[state.scoring];
    elements.refreshed.textContent = formatDate(data.meta.dataLastRefreshed);
    elements.datasetNote.textContent = market.snapshot ? `Guru ranks + ${market.consensusSource}` : "Guru ranks + local Yahoo-primary ADP";
    const consensusNote = market.snapshot
      ? `Consensus ADP is a validated ${market.consensusSource} snapshot refreshed ${formatSnapshotDate(market.snapshot.fetchedAt)}. It changes market ADP only, not the ranking baseline.`
      : `Consensus ADP falls back to the local source AVG because no matching validated DraftSharks snapshot is loaded.`;
    elements.provisional.hidden = false;
    elements.provisional.textContent = `${board.note || ""} ${state.formatLabel} uses ${state.teams} teams, 1 QB, 2 RB, 2 WR, 1 TE, ${state.flex} W/R/T flex, K, DEF, and 5 bench spots. Base scoring uses available passing/rushing/receiving/fumble categories; first-down fields and game-level 100/150/200-yard bonus splits are absent from the supplied projection CSV and are excluded. ${consensusNote}`.trim();
    elements.draftProfile.textContent = `${state.teams} teams · Slot ${state.slot}`;
    elements.formatProfile.textContent = `${state.formatLabel} · ${state.flex} W/R/T flex`;
    const [firstPick] = snakePicks(state.teams, state.slot, 1);
    elements.nextPick.textContent = formatPick(firstPick, state.teams);
    elements.nextOverall.textContent = `Overall pick ${firstPick}`;
  };

  const renderPickMap = (state, picks) => {
    elements.pickMap.replaceChildren(...picks.map((pick, index) => {
      const item = document.createElement("li");
      item.innerHTML = `<span>Round ${index + 1}</span><strong>${formatPick(pick, state.teams)}</strong><span>Overall ${pick}</span>`;
      return item;
    }));
  };

  const getQueue = (players, picks, state, market, scarcity) => {
    const selectedIds = new Set();
    const roster = { QB: 0, RB: 0, WR: 0, TE: 0 };
    return picks.map((pick, index) => {
      const round = index + 1;
      const nextPick = picks[index + 1] ?? snakePicks(state.teams, state.slot, 16)[15];
      const candidates = players
        .filter((player) => !selectedIds.has(player.id) && targetWindow(player, market))
        .map((player) => {
          const status = classify(player, pick, nextPick, market);
          const { adp } = targetWindow(player, market);
          const earlyBy = adp - pick;
          const availability = availabilityEstimate(player, pick, market).probability;
          const survival = nextPickSurvival(player, pick, nextPick, market);
          const marketAction = captureAction(player, pick, nextPick, market);
          const gameTheory = scarcityAction(player, pick, nextPick, market, scarcity, roster, marketAction);
          const vorp = scarcity.vorp.get(player.id);
          const projection = scarcity.projectionById.get(player.id);
          const score = (150 - player.rank) + preferredPositionScore(player, round, state.flex)
            + Math.min(50, Math.max(0, valueGap(player, market))) * .2
            + (isAdp(vorp) ? Math.min(50, Math.max(0, vorp)) * .1 : 0)
            - Math.abs(earlyBy) * .45 - (status.className === "avoid" ? 500 : 0);
          return {
            player, status, score, consensus: consensusAdp(player, market), availability, survival,
            marketAction, gameTheory, vorp, projection
          };
        })
        .filter(({ player, status }) => status.className !== "avoid" && isPlausiblyAvailable(player, pick, market))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      if (candidates[0]) {
        selectedIds.add(candidates[0].player.id);
        if (roster[candidates[0].player.position] !== undefined) {
          roster[candidates[0].player.position] += 1;
        }
      }
      return { pick, nextPick, round, candidates };
    });
  };

  const renderQueue = (queue, state) => {
    elements.queue.replaceChildren(...queue.map(({ pick, round, candidates }) => {
      const card = document.createElement("article");
      card.className = "round-card";
      const fallback = candidates.length === 0
        ? "<p class=\"queue-fallback\">No target clears the 8% availability threshold at this pick. Refresh or expand the source-backed board.</p>"
        : candidates.length < 3
          ? `<p class="queue-fallback">Only ${candidates.length} plausible target${candidates.length === 1 ? "" : "s"} remain at this pick.</p>`
          : "";
      card.innerHTML = `
        <header><strong>Round ${round}</strong><span>${formatPick(pick, state.teams)} · Overall ${pick}</span></header>
        ${candidates.length ? `<ol class="queue-options">
          ${candidates.map(({ player, status, consensus, availability, survival, gameTheory, vorp, projection }) => `
            <li>
              <span>
                <span class="queue-player">${player.name} <span aria-label="${player.position}">${player.position}</span></span>
                <span class="queue-meta">Rank ${player.rank} · ${formatByeWeek(player)} · Yahoo ${formatAdp(player.adp.yahoo)} · Consensus ${formatAdp(consensus)} · ${status.detail}</span>
                <span class="queue-meta"><strong>Available ${formatProbability(availability)}</strong> · Next-pick survival ${formatProbability(survival)} · <strong>${gameTheory.action}</strong></span>
                <span class="queue-meta">${formatPoints(projection)} · VORP ${isAdp(vorp) ? vorp.toFixed(1) : "unavailable"} · ${gameTheory.drop.label}${isAdp(gameTheory.drop.projectionDrop) ? ` (${gameTheory.drop.projectionDrop.toFixed(1)} pts)` : ""} · ${gameTheory.need}</span>
              </span>
              <span class="tag ${status.className}">${status.label}</span>
            </li>`).join("")}
        </ol>${fallback}` : fallback}`;
      return card;
    }));
  };

  const renderRankings = (players, state, market, scarcity) => {
    const query = elements.search.value.trim().toLowerCase();
    const nextPick = snakePicks(state.teams, state.slot, 1)[0];
    const followingPick = snakePicks(state.teams, state.slot, 2)[1];
    const matching = players.filter((player) => `${player.name} ${player.position} ${player.team} ${formatByeWeek(player)}`.toLowerCase().includes(query));
    elements.rankings.replaceChildren(...matching.map((player) => {
      const window = targetWindow(player, market);
      const status = classify(player, nextPick, followingPick, market);
      const consensus = consensusAdp(player, market);
      const availability = availabilityEstimate(player, nextPick, market).probability;
      const action = captureAction(player, nextPick, followingPick, market);
      const projection = scarcity.projectionById.get(player.id);
      const vorp = scarcity.vorp.get(player.id);
      const positionalTier = scarcity.positionalTier.get(player.id);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${player.rank}</td>
        <td class="player-cell"><strong>${player.name}</strong><small>${player.team} · ${formatByeWeek(player)} · ${isAdp(projection) ? "projection matched" : "projection unavailable"}</small></td>
        <td>${player.position}</td>
        <td>${formatAdp(player.adp.yahoo)}</td>
        <td>${formatAdp(consensus)}</td>
        <td>${window ? formatAdp(window.adp) : "N/A"}</td>
        <td>${formatProbability(availability)}<small>${action}</small></td>
        <td>${formatPoints(projection)}<small>VORP ${isAdp(vorp) ? vorp.toFixed(1) : "unavailable"}</small></td>
        <td>Tier ${positionalTier || "N/A"}<small>Guru rank-derived</small></td>
        <td><span class="tag ${status.className}" title="${status.detail}">${window ? `${window.start}–${window.end}` : "N/A"}</span></td>`;
      return row;
    }));
  };

  const renderSources = () => {
    elements.sources.replaceChildren(...Object.values(data.sources).map((source) => {
      const container = document.createElement("div");
      container.innerHTML = `<dt>${source.name} <span class="source-role">${source.role}</span></dt><dd>${formatDate(source.refreshedAt)} · ${(source.weight * 100).toFixed(0)}% market weight</dd>`;
      return container;
    }));
  };

  const render = () => {
    const state = getState();
    const players = getPlayers(state.scoring);
    const picks = snakePicks(state.teams, state.slot, 15);
    const market = getMarketContext(state);
    const scarcity = createScarcityModel(players, state, market);
    renderMeta(state, market);
    renderLeagueModel(state, scarcity);
    renderPickMap(state, picks);
    renderQueue(getQueue(players, picks, state, market, scarcity), state);
    renderRankings(players, state, market, scarcity);
    renderDraftSharks(state, market);
    renderDraftRoom(players, state, market, scarcity);
  };

  const resetDraftForSettings = () => {
    draftRoomState.picks = [];
    draftRoomState.started = false;
    draftRoomState.statusMessage = "";
    renderSlots();
    render();
  };
  elements.leagueFormat.addEventListener("change", resetDraftForSettings);
  elements.teams.addEventListener("change", resetDraftForSettings);
  elements.flex.addEventListener("change", resetDraftForSettings);
  [elements.slot].forEach((control) => control.addEventListener("change", resetDraftForSettings));
  elements.search.addEventListener("input", render);
  elements.draftPlayerSearch.addEventListener("input", render);
  [elements.draftPositionFilter, elements.draftNeedsOnly, elements.aiRisk].forEach((control) => control.addEventListener("change", render));
  elements.draftMode.addEventListener("change", () => {
    const state = getState();
    draftRoomState.mode = elements.draftMode.value;
    draftRoomState.statusMessage = "";
    draftRoomState.started = false;
    if (draftRoomState.mode === "live") {
      loadLiveDraft(state);
    } else if (draftRoomState.mode === "mock") {
      draftRoomState.picks = [];
      draftRoomState.seed = Number(elements.mockSeed.value) || 2026;
    }
    render();
  });
  elements.draftStart.addEventListener("click", () => {
    const state = getState();
    if (draftRoomState.mode === "cheat" || draftRoomState.started) {
      return;
    }
    draftRoomState.picks = [];
    draftRoomState.started = true;
    draftRoomState.statusMessage = "";
    if (draftRoomState.mode === "mock") {
      draftRoomState.seed = Number(elements.mockSeed.value) || 2026;
      const players = getPlayers(state.scoring);
      const market = getMarketContext(state);
      const scarcity = createScarcityModel(players, state, market);
      playMockUntilUser(players, state, market, scarcity);
    } else {
      clearLiveDraft(state);
      saveLiveDraft(state);
    }
    render();
  });
  elements.availablePlayers.addEventListener("click", (event) => {
    const button = event.target.closest("[data-draft-player]");
    if (!button) {
      return;
    }
    const state = getState();
    const currentPick = getCurrentOverallPick();
    const snakeOwner = pickOwner(currentPick, state.teams);
    if (!draftRoomState.started || (draftRoomState.mode === "mock" && snakeOwner !== state.slot)) {
      return;
    }
    if (addDraftPick(button.dataset.draftPlayer, state, snakeOwner)) {
      if (draftRoomState.mode === "mock") {
        const players = getPlayers(state.scoring);
        const market = getMarketContext(state);
        const scarcity = createScarcityModel(players, state, market);
        playMockUntilUser(players, state, market, scarcity);
      }
      render();
    }
  });
  elements.mockNext.addEventListener("click", () => {
    if (draftRoomState.mode !== "mock" || !draftRoomState.started) {
      return;
    }
    const state = getState();
    const players = getPlayers(state.scoring);
    const market = getMarketContext(state);
    const scarcity = createScarcityModel(players, state, market);
    playMockUntilUser(players, state, market, scarcity, true);
    render();
  });
  elements.mockRun.addEventListener("click", () => {
    if (draftRoomState.mode !== "mock" || !draftRoomState.started) {
      return;
    }
    const state = getState();
    const players = getPlayers(state.scoring);
    const market = getMarketContext(state);
    const scarcity = createScarcityModel(players, state, market);
    playMockUntilUser(players, state, market, scarcity);
    render();
  });
  elements.draftUndo.addEventListener("click", () => {
    if (!draftRoomState.started) {
      return;
    }
    draftRoomState.picks.pop();
    saveLiveDraft(getState());
    render();
  });
  elements.draftReset.addEventListener("click", () => {
    if (window.confirm("Restart this draft and unlock all settings? This clears the current board.")) {
      draftRoomState.picks = [];
      draftRoomState.started = false;
      draftRoomState.statusMessage = "Draft reset. Settings are unlocked.";
      clearLiveDraft(getState());
      render();
    }
  });

  renderSlots();
  renderSources();
  loadDraftSharksSnapshots();
  render();
}());
