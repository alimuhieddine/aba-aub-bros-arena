// Match helpers for the gradual app.js split.
// Keep this module limited to pure match data helpers.
(function () {
  function invitationMember(invitation) {
    return invitation?.member || null;
  }

  function invitationCounts(match) {
    const invitations = match.match_invitations || [];
    const hasCreatorInvitation = invitations.some(inv =>
      inv.member_id === match.created_by && inv.status !== "removed"
    );

    let inCount = invitations.filter(inv => inv.status === "in").length;

    if (match.created_by && !hasCreatorInvitation) {
      inCount += 1;
    }

    return {
      inCount,
      maybeCount: invitations.filter(inv => inv.status === "maybe").length,
      outCount: invitations.filter(inv => inv.status === "out").length,
      invitedCount: invitations.filter(inv => inv.status === "invited").length
    };
  }

  function isExternalInvitation(invitation) {
    return Boolean(invitationMember(invitation)?.is_external);
  }

  function externalPlayerInvitations(match) {
    return (match.match_invitations || []).filter(inv =>
      inv.status === "in" && isExternalInvitation(inv)
    );
  }

  function externalPlayerCount(match) {
    return externalPlayerInvitations(match).length;
  }

  function filledPlayerCount(match) {
    return invitationCounts(match).inCount;
  }

  function remainingSpots(match) {
    const maxPlayers = Number(match.max_players || 0);
    if (!maxPlayers) return null;

    return Math.max(0, maxPlayers - filledPlayerCount(match));
  }

  function timeIntervalsOverlap(matchA, matchB) {
    if (!matchA?.start_time || !matchA?.end_time || !matchB?.start_time || !matchB?.end_time) {
      return false;
    }

    const startA = new Date(matchA.start_time).getTime();
    const endA = new Date(matchA.end_time).getTime();
    const startB = new Date(matchB.start_time).getTime();
    const endB = new Date(matchB.end_time).getTime();

    if (![startA, endA, startB, endB].every(Number.isFinite)) return false;

    return startA < endB && endA > startB;
  }

  function displayStatus(match) {
    if (match.status === "cancelled") return "cancelled";
    if (match.status === "completed") return "completed";

    const now = new Date();
    const start = new Date(match.start_time);
    const end = new Date(match.end_time);

    if (now >= start && now <= end) return "playing";
    if (now > end) return "finished";

    return match.status || "open_for_votes";
  }

  function statusClass(status, isFull) {
    if (status === "cancelled") return "red";
    if (status === "playing") return "gold";
    if (status === "finished" || status === "completed") return "blue";
    if (isFull) return "blue";
    return "green";
  }

  function isVotingOpen(match) {
    const status = displayStatus(match);
    return status !== "cancelled" &&
      status !== "playing" &&
      status !== "finished" &&
      status !== "completed" &&
      new Date(match.start_time) > new Date();
  }

  function isEditable(match) {
    return displayStatus(match) !== "cancelled" &&
      new Date(match.start_time) > new Date();
  }

  window.ABAMatches = {
    invitationMember,
    invitationCounts,
    isExternalInvitation,
    externalPlayerInvitations,
    externalPlayerCount,
    filledPlayerCount,
    remainingSpots,
    timeIntervalsOverlap,
    displayStatus,
    statusClass,
    isVotingOpen,
    isEditable
  };
})();
