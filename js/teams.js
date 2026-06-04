// Team helpers for the gradual app.js split.
// Keep this module limited to pure team lookup and side helpers.
(function () {
  function cleanUuidValue(value) {
    return window.ABAUtils?.cleanUuidValue
      ? window.ABAUtils.cleanUuidValue(value)
      : value;
  }

  function sideForTeam(match, team) {
    const teams = match.match_teams || [];
    return team?.color || (teams[0]?.id === team?.id ? "A" : teams[1]?.id === team?.id ? "B" : "");
  }

  function playerSideFromTeamId(match, teamId) {
    const teams = match.match_teams || [];
    const team = teams.find(item => item.id === teamId);
    return team ? sideForTeam(match, team) : "";
  }

  function captainSidesForMember(match, memberId) {
    const cleanMemberId = cleanUuidValue(memberId);
    if (!cleanMemberId) return [];

    const sides = [];

    (match.match_teams || []).forEach((team, index) => {
      const side = sideForTeam(match, team) || (index === 0 ? "A" : "B");
      const isCaptain = (team.match_team_players || []).some(player =>
        player.is_captain && cleanUuidValue(player.member_id) === cleanMemberId
      );

      if (isCaptain && side) sides.push(side);
    });

    return sides;
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

  function preferredSideOrder({ captainSides = [], formationOnly = false } = {}) {
    if (formationOnly && captainSides.length) {
      const firstCaptainSide = captainSides[0];
      return firstCaptainSide === "B" ? ["B", "A", ""] : ["A", "B", ""];
    }

    return ["A", "B", ""];
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

  function pointText(match, team) {
    const pointsByMember = new Map();

    (match.match_member_points || []).forEach(point => {
      if (point.member_id) {
        pointsByMember.set(point.member_id, Number(point.total_points || 0));
      }
    });

    const pointValues = (team.match_team_players || [])
      .map(player => pointsByMember.get(player.member_id))
      .filter(value => Number.isFinite(value));

    const uniquePointValues = Array.from(new Set(pointValues));

    if (!uniquePointValues.length) return "";

    return uniquePointValues.length === 1
      ? `+${uniquePointValues[0]} pts each`
      : uniquePointValues.map(value => `+${value}`).join(" / ");
  }

  window.ABATeams = {
    sideForTeam,
    playerSideFromTeamId,
    captainSidesForMember,
    sideSortValue,
    sideLabel,
    sideOrderValue,
    teamNameForSide,
    preferredSideOrder,
    currentTeamByMemberId,
    currentTeamPlayerByMemberId,
    pointText
  };
})();
