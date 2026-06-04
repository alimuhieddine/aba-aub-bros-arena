// Team helpers for the gradual app.js split.
// Keep this module limited to pure team lookup and side helpers.
(function () {
  function sideForTeam(match, team) {
    const teams = match.match_teams || [];
    return team?.color || (teams[0]?.id === team?.id ? "A" : teams[1]?.id === team?.id ? "B" : "");
  }

  function playerSideFromTeamId(match, teamId) {
    const teams = match.match_teams || [];
    const team = teams.find(item => item.id === teamId);
    return team ? sideForTeam(match, team) : "";
  }

  function sideSortValue(side) {
    if (side === "A") return 1;
    if (side === "B") return 2;
    return 3;
  }

  function sideLabel(side) {
    if (side === "A") return "Team A";
    if (side === "B") return "Team B";
    return "Unassigned";
  }

  function sideOrderValue(side, orderedSides) {
    const index = orderedSides.indexOf(side);
    return index === -1 ? 99 : index;
  }

  function teamNameForSide(match, side) {
    const teams = match.match_teams || [];
    const team =
      teams.find(item => item.color === side) ||
      (side === "A" ? teams[0] : side === "B" ? teams[1] : null);

    return team?.name || sideLabel(side);
  }

  function currentTeamByMemberId(match) {
    const map = new Map();

    (match.match_teams || []).forEach(team => {
      (team.match_team_players || []).forEach(tp => {
        if (tp.member_id) map.set(tp.member_id, team.id);
      });
    });

    return map;
  }

  function currentTeamPlayerByMemberId(match) {
    const map = new Map();

    (match.match_teams || []).forEach(team => {
      (team.match_team_players || []).forEach(tp => {
        if (tp.member_id) {
          map.set(tp.member_id, {
            ...tp,
            team_id: team.id,
            team_color: team.color
          });
        }
      });
    });

    return map;
  }

  window.ABATeams = {
    sideForTeam,
    playerSideFromTeamId,
    sideSortValue,
    sideLabel,
    sideOrderValue,
    teamNameForSide,
    currentTeamByMemberId,
    currentTeamPlayerByMemberId
  };
})();
