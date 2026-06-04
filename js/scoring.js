// Scoring helpers for the gradual app.js split.
// Keep this module limited to read-only score data helpers for now.
(function () {
  function scoreEntries(match, entryType = null) {
    const entries = match.match_score_entries || [];

    return entryType
      ? entries.filter(entry => entry.entry_type === entryType)
      : entries;
  }

  function scoreEntriesForGame(match, gameId) {
    return (match.match_score_entries || []).filter(entry =>
      entry.game_id === gameId
    );
  }

  function matchSessionGames(match) {
    const byId = new Map();

    (match.match_game_sessions || [])
      .map(session => session.match_games)
      .filter(Boolean)
      .forEach(game => {
        if (game?.id && !byId.has(game.id)) {
          byId.set(game.id, game);
        }
      });

    return Array.from(byId.values());
  }

  function finalizableMatchGames(match) {
    return matchSessionGames(match).filter(game => game.status === "completed");
  }

  function completedGameScoreForMatch(match, extraGame = null) {
    let games = finalizableMatchGames(match);

    if (extraGame) {
      games = games.filter(game => game.id !== extraGame.id);

      if (extraGame.status === "completed") {
        games.push(extraGame);
      }
    }

    return {
      teamA: games.filter(game => game.winner_team === "A").length,
      teamB: games.filter(game => game.winner_team === "B").length
    };
  }

  function isValidCompletedPadelSet(scoreA, scoreB) {
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return false;
    if (scoreA < 0 || scoreB < 0) return false;
    if (scoreA === scoreB) return false;

    const high = Math.max(scoreA, scoreB);
    const low = Math.min(scoreA, scoreB);
    const diff = high - low;

    // Standard set: 6 games with at least 2 games difference.
    if (high === 6) {
      return low <= 4;
    }

    if (high === 7) {
      return low === 5 || low === 6;
    }

    if (high > 7) {
      return diff === 2;
    }

    return false;
  }

  function shouldAutoCompletePadelSet(scoreA, scoreB) {
    return isValidCompletedPadelSet(scoreA, scoreB);
  }

  function calculatePadelSetResult(sets) {
    let teamASetWins = 0;
    let teamBSetWins = 0;

    const validSets = [];

    for (const set of sets) {
      if (!set.hasAnyValue) continue;

      if (
        set.teamAScore === null ||
        set.teamBScore === null ||
        !Number.isInteger(set.teamAScore) ||
        !Number.isInteger(set.teamBScore) ||
        set.teamAScore < 0 ||
        set.teamBScore < 0
      ) {
        return {
          error: "Padel set scores must be whole numbers equal to or greater than 0."
        };
      }

      if (set.isCompleted && !isValidCompletedPadelSet(set.teamAScore, set.teamBScore)) {
        return {
          error: `Set ${set.setNumber} cannot be marked complete with ${set.teamAScore}-${set.teamBScore}. Valid completed set scores are 6-0 to 6-4, 7-5, 7-6 for tie-break sets, or 8-6 / 9-7 / 10-8 etc. for advantage sets.`
        };
      }

      validSets.push(set);

      if (set.isCompleted) {
        if (set.teamAScore > set.teamBScore) teamASetWins += 1;
        if (set.teamBScore > set.teamAScore) teamBSetWins += 1;
      }
    }

    if (validSets.length === 0) {
      return {
        error: "Enter at least one padel set."
      };
    }

    return {
      teamASetWins,
      teamBSetWins,
      validSets
    };
  }

  function padelGameStatusLabel(game, gameSets = []) {
    if (!game) return "";

    const incompleteSets = gameSets.filter(set => !set.is_completed).length;
    const unstartedSets = Math.max(0, 3 - gameSets.length);

    if (game.status === "completed") {
      return "completed";
    }

    if (incompleteSets > 0) {
      return `incomplete — ${incompleteSets} incomplete set${incompleteSets === 1 ? "" : "s"}`;
    }

    if (unstartedSets > 0) {
      return `incomplete — ${unstartedSets} remaining unstarted set${unstartedSets === 1 ? "" : "s"}`;
    }

    return "incomplete";
  }

  function renderScoreSummary(match, {
    hasSubmittedScore,
    isPadelMatch,
    escapeHtml
  } = {}) {
    if (!hasSubmittedScore?.(match)) return "";

    const htmlEscape = escapeHtml || (value => String(value ?? ""));
    const sessionGames = matchSessionGames(match);
    const legacyPadelSets = scoreEntries(match, "padel_set")
      .filter(entry => !entry.game_id)
      .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0));

    const padelDetails = isPadelMatch?.(match)
      ? sessionGames.length
        ? `
          <div class="padel-score-summary">
            ${sessionGames.map((game, index) => {
              const gameSets = scoreEntriesForGame(match, game.id)
                .filter(entry => entry.entry_type === "padel_set")
                .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0));

              return `
                <div>
                  <strong>${htmlEscape(game.title || `Game ${index + 1}`)}</strong>
                  — ${htmlEscape(padelGameStatusLabel(game, gameSets))}
                  ${game.winner_team ? ` • Winner: Team ${htmlEscape(game.winner_team)}` : ""}
                </div>
                ${gameSets.map(set => `
                  <div>
                    Set ${Number(set.set_number || 0)}:
                    ${Number(set.team_a_score || 0)}-${Number(set.team_b_score || 0)}
                    ${set.is_completed ? "" : " incomplete"}
                  </div>
                `).join("")}
              `;
            }).join("")}
          </div>
        `
        : legacyPadelSets.length
          ? `
            <div class="padel-score-summary">
              ${legacyPadelSets.map(set => `
                <div>
                  Set ${Number(set.set_number || 0)}:
                  ${Number(set.team_a_score || 0)}-${Number(set.team_b_score || 0)}
                  ${set.is_completed ? "" : " incomplete"}
                </div>
              `).join("")}
            </div>
          `
          : ""
      : "";

    const notes = match.notes
      ? `<div class="score-notes">${htmlEscape(match.notes)}</div>`
      : "";

    if (!padelDetails && !notes) return "";

    return `
      <div class="score-summary compact-score-summary">
        ${padelDetails}
        ${notes}
      </div>
    `;
  }

  window.ABAScoring = {
    scoreEntries,
    scoreEntriesForGame,
    matchSessionGames,
    finalizableMatchGames,
    completedGameScoreForMatch,
    isValidCompletedPadelSet,
    shouldAutoCompletePadelSet,
    calculatePadelSetResult,
    padelGameStatusLabel,
    renderScoreSummary
  };
})();
