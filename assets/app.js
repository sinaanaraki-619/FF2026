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
    search: document.querySelector("#player-search")
  };

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

  const consensusAdp = (player) => player.adp.average;

  const weightedAdp = (player) => {
    const yahooWeight = data.sources.yahoo.weight;
    return player.adp.yahoo * yahooWeight + consensusAdp(player) * (1 - yahooWeight);
  };

  const targetWindow = (player) => {
    if (!isAdp(player.adp.yahoo) || !isAdp(consensusAdp(player))) {
      return null;
    }
    const adp = weightedAdp(player);
    return {
      adp,
      start: Math.max(1, Math.ceil(adp - 12)),
      preferredStart: Math.max(1, Math.ceil(adp - 8)),
      marketStart: Math.max(1, Math.ceil(adp - 3)),
      end: Math.ceil(adp + 5)
    };
  };

  const availabilityGracePicks = (teams) => Math.ceil(teams / 2);

  const isPlausiblyAvailable = (player, pick, teams) => {
    if (!targetWindow(player)) {
      return false;
    }
    const grace = availabilityGracePicks(teams);
    const yahooExpired = pick - player.adp.yahoo > grace;
    const consensusExpired = pick - consensusAdp(player) > grace;
    return !(yahooExpired && consensusExpired);
  };

  const classify = (player, pick) => {
    const window = targetWindow(player);
    if (!window) {
      return { label: "Avoid", className: "avoid", detail: "missing Yahoo or source AVG" };
    }
    const { adp } = window;
    const earlyBy = Math.round(adp - pick);
    const lateBy = Math.round(pick - adp);

    if (earlyBy > 12) {
      return { label: "Avoid", className: "avoid", detail: `${earlyBy} early exceeds guardrail` };
    }
    if (lateBy >= 9) {
      return { label: "Major steal", className: "major-steal", detail: `${lateBy} past market` };
    }
    if (earlyBy >= 9) {
      if (player.tier <= 2) {
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

  const renderMeta = (state) => {
    const board = data.rankings[state.scoring];
    elements.refreshed.textContent = formatDate(data.meta.dataLastRefreshed);
    elements.datasetNote.textContent = data.meta.isSampleData ? "Illustrative seed data" : "Local data file";
    elements.provisional.hidden = !board.provisional;
    elements.provisional.textContent = board.note || "";
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

  const getQueue = (players, picks, state) => {
    const selectedIds = new Set();
    return picks.map((pick, index) => {
      const round = index + 1;
      const candidates = players
        .filter((player) => !selectedIds.has(player.id) && targetWindow(player))
        .map((player) => {
          const status = classify(player, pick);
          const { adp } = targetWindow(player);
          const earlyBy = adp - pick;
          const score = (150 - player.rank) + preferredPositionScore(player, round, state.flex)
            - Math.abs(earlyBy) * .45 - (status.className === "avoid" ? 500 : 0);
          return { player, status, score, consensus: consensusAdp(player) };
        })
        .filter(({ player, status }) => status.className !== "avoid" && isPlausiblyAvailable(player, pick, state.teams))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      if (candidates[0]) {
        selectedIds.add(candidates[0].player.id);
      }
      return { pick, round, candidates };
    });
  };

  const renderQueue = (queue, state) => {
    elements.queue.replaceChildren(...queue.map(({ pick, round, candidates }) => {
      const card = document.createElement("article");
      card.className = "round-card";
      const fallback = candidates.length === 0
        ? "<p class=\"queue-fallback\">No plausible target remains in this source-backed board. Refresh or expand the rankings before this pick.</p>"
        : candidates.length < 3
          ? `<p class="queue-fallback">Only ${candidates.length} plausible target${candidates.length === 1 ? "" : "s"} remain at this pick.</p>`
          : "";
      card.innerHTML = `
        <header><strong>Round ${round}</strong><span>${formatPick(pick, state.teams)} · Overall ${pick}</span></header>
        ${candidates.length ? `<ol class="queue-options">
          ${candidates.map(({ player, status, consensus }) => `
            <li>
              <span>
                <span class="queue-player">${player.name} <span aria-label="${player.position}">${player.position}</span></span>
                <span class="queue-meta">Rank ${player.rank} · Yahoo ${formatAdp(player.adp.yahoo)} · Consensus ${formatAdp(consensus)} · ${status.detail}</span>
              </span>
              <span class="tag ${status.className}">${status.label}</span>
            </li>`).join("")}
        </ol>${fallback}` : fallback}`;
      return card;
    }));
  };

  const renderRankings = (players, state) => {
    const query = elements.search.value.trim().toLowerCase();
    const nextPick = snakePicks(state.teams, state.slot, 1)[0];
    const matching = players.filter((player) => `${player.name} ${player.position} ${player.team}`.toLowerCase().includes(query));
    elements.rankings.replaceChildren(...matching.map((player) => {
      const window = targetWindow(player);
      const status = classify(player, nextPick);
      const consensus = consensusAdp(player);
      const projection = isAdp(player.projectedPoints) ? `${player.projectedPoints.toFixed(1)} pts/g` : "source-ranked";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${player.rank}</td>
        <td class="player-cell"><strong>${player.name}</strong><small>${player.team} · ${projection}</small></td>
        <td>${player.position}</td>
        <td>${formatAdp(player.adp.yahoo)}</td>
        <td>${formatAdp(consensus)}</td>
        <td>${window ? formatAdp(window.adp) : "N/A"}</td>
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
    renderMeta(state);
    renderPickMap(state, picks);
    renderQueue(getQueue(players, picks, state), state);
    renderRankings(players, state);
  };

  elements.teams.addEventListener("change", () => {
    renderSlots();
    render();
  });
  [elements.scoring, elements.slot, elements.flex].forEach((control) => control.addEventListener("change", render));
  elements.search.addEventListener("input", render);

  renderSlots();
  renderSources();
  render();
}());
