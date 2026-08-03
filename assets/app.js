(function () {
  "use strict";

  const data = window.DRAFT_DASHBOARD_DATA;
  const elements = {
    scoring: document.querySelector("#scoring"),
    teams: document.querySelector("#teams"),
    slot: document.querySelector("#slot"),
    flex: document.querySelector("#flex"),
    refreshed: document.querySelector("#data-refreshed"),
    datasetNote: document.querySelector("#dataset-note"),
    provisional: document.querySelector("#provisional-message"),
    draftProfile: document.querySelector("#draft-profile"),
    formatProfile: document.querySelector("#format-profile"),
    nextPick: document.querySelector("#next-pick"),
    nextOverall: document.querySelector("#next-overall"),
    pickMap: document.querySelector("#pick-map"),
    queue: document.querySelector("#draft-queue"),
    rankings: document.querySelector("#rankings-body"),
    sources: document.querySelector("#source-list"),
    search: document.querySelector("#player-search"),
    draftSharksSource: document.querySelector("#draftsharks-source"),
    draftSharksRefresh: document.querySelector("#draftsharks-refresh"),
    draftSharksStatus: document.querySelector("#draftsharks-status")
  };

  const workflowUrl = "https://github.com/sinaanaraki-619/FF2026/actions/workflows/refresh-draftsharks-adp.yml";
  const draftSharksState = { snapshots: [] };

  const roundNeeds = [
    ["RB", "WR"], ["WR", "RB"], ["RB", "WR"], ["WR", "RB", "TE"], ["RB", "WR"],
    ["WR", "QB", "TE"], ["RB", "WR"], ["WR", "RB"], ["QB", "TE", "WR"], ["RB", "WR"],
    ["WR", "RB", "TE"], ["RB", "WR", "QB"], ["WR", "RB", "TE"], ["RB", "WR", "QB"],
    ["RB", "WR", "TE"]
  ];

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

  const getState = () => ({
    scoring: elements.scoring.value,
    teams: Number(elements.teams.value),
    slot: Number(elements.slot.value),
    flex: Number(elements.flex.value)
  });

  const getPlayers = (scoring) => data.rankings[scoring].items;

  const formatSnapshotDate = (date) => isAdp(Date.parse(date)) ? formatDate(date) : "unknown time";

  const renderDraftSharks = (state, market) => {
    const sourceUrl = draftSharksUrl(state);
    elements.draftSharksSource.href = sourceUrl;
    elements.draftSharksSource.textContent = `Open DraftSharks ${state.scoring === "halfPpr" ? "half-PPR" : "PPR"} ${state.teams}-team source`;
    elements.draftSharksRefresh.href = `${workflowUrl}?query=branch%3Asinaanaraki-619-build-draft-dashboard`;

    if (market.snapshot) {
      elements.draftSharksStatus.textContent = `Consensus ADP: ${market.consensusSource}, refreshed ${formatSnapshotDate(market.snapshot.fetchedAt)} (${market.snapshot.recordCount} validated records). It changes market ADP only; Guru rankings remain unchanged. Players absent from the snapshot use local AVG.`;
    } else {
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
    elements.provisional.hidden = !board.provisional;
    if (board.provisional) {
      const consensusNote = market.snapshot
        ? `Consensus ADP is a validated ${market.consensusSource} snapshot refreshed ${formatSnapshotDate(market.snapshot.fetchedAt)}. It changes market ADP only, not the ranking baseline.`
        : `Consensus ADP falls back to the local source AVG because no matching validated DraftSharks snapshot is loaded.`;
      elements.provisional.textContent = `${board.note} ${consensusNote}`;
    }
    elements.draftProfile.textContent = `${state.teams} teams · Slot ${state.slot}`;
    elements.formatProfile.textContent = `${board.label} · ${state.flex} flex ${state.flex === 1 ? "slot" : "slots"}`;
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

  const getQueue = (players, picks, state, market) => {
    const selectedIds = new Set();
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
          const action = captureAction(player, pick, nextPick, market);
          const score = (150 - player.rank) + preferredPositionScore(player, round, state.flex)
            + Math.min(50, Math.max(0, valueGap(player, market))) * .2
            - Math.abs(earlyBy) * .45 - (status.className === "avoid" ? 500 : 0);
          return { player, status, score, consensus: consensusAdp(player, market), availability, survival, action };
        })
        .filter(({ player, status }) => status.className !== "avoid" && isPlausiblyAvailable(player, pick, market))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      if (candidates[0]) {
        selectedIds.add(candidates[0].player.id);
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
          ${candidates.map(({ player, status, consensus, availability, survival, action }) => `
            <li>
              <span>
                <span class="queue-player">${player.name} <span aria-label="${player.position}">${player.position}</span></span>
                <span class="queue-meta">Rank ${player.rank} · Yahoo ${formatAdp(player.adp.yahoo)} · Consensus ${formatAdp(consensus)} · ${status.detail}</span>
                <span class="queue-meta"><strong>Available ${formatProbability(availability)}</strong> · Next-pick survival ${formatProbability(survival)} · <strong>${action}</strong></span>
              </span>
              <span class="tag ${status.className}">${status.label}</span>
            </li>`).join("")}
        </ol>${fallback}` : fallback}`;
      return card;
    }));
  };

  const renderRankings = (players, state, market) => {
    const query = elements.search.value.trim().toLowerCase();
    const nextPick = snakePicks(state.teams, state.slot, 1)[0];
    const followingPick = snakePicks(state.teams, state.slot, 2)[1];
    const matching = players.filter((player) => `${player.name} ${player.position} ${player.team}`.toLowerCase().includes(query));
    elements.rankings.replaceChildren(...matching.map((player) => {
      const window = targetWindow(player, market);
      const status = classify(player, nextPick, followingPick, market);
      const consensus = consensusAdp(player, market);
      const availability = availabilityEstimate(player, nextPick, market).probability;
      const action = captureAction(player, nextPick, followingPick, market);
      const projection = isAdp(player.projectedPoints) ? `${player.projectedPoints.toFixed(1)} pts/g` : "source-ranked";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${player.rank}</td>
        <td class="player-cell"><strong>${player.name}</strong><small>${player.team} · ${projection}</small></td>
        <td>${player.position}</td>
        <td>${formatAdp(player.adp.yahoo)}</td>
        <td>${formatAdp(consensus)}</td>
        <td>${window ? formatAdp(window.adp) : "N/A"}</td>
        <td>${formatProbability(availability)}<small>${action}</small></td>
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
    renderMeta(state, market);
    renderPickMap(state, picks);
    renderQueue(getQueue(players, picks, state, market), state);
    renderRankings(players, state, market);
    renderDraftSharks(state, market);
  };

  elements.teams.addEventListener("change", () => {
    renderSlots();
    render();
  });
  [elements.scoring, elements.slot, elements.flex].forEach((control) => control.addEventListener("change", render));
  elements.search.addEventListener("input", render);

  renderSlots();
  renderSources();
  loadDraftSharksSnapshots();
  render();
}());
