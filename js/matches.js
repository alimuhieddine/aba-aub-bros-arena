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

  window.ABAMatches = {
    invitationMember,
    invitationCounts,
    isExternalInvitation,
    externalPlayerInvitations,
    externalPlayerCount,
    filledPlayerCount,
    remainingSpots
  };
})();
