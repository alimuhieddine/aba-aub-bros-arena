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

  window.ABAScoring = {
    scoreEntries,
    scoreEntriesForGame
  };
})();
