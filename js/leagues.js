// League helpers for the gradual app.js split.
// Keep this module limited to stateless or storage-backed helpers.
(function () {
  const LEAGUE_SECTION_DEFAULTS = {
    players: true,
    teams: true,
    positions: false,
    history: false
  };

  function utils() {
    return window.ABAUtils || {};
  }

  function escapeHtml(value) {
    return utils().escapeHtml ? utils().escapeHtml(value) : String(value ?? "");
  }

  function sectionStorageKey(leagueId, sectionKey) {
    return `league_section_${leagueId}_${sectionKey}`;
  }

  function isSectionOpen(leagueId, sectionKey) {
    const saved = localStorage.getItem(sectionStorageKey(leagueId, sectionKey));

    if (saved === "open") return true;
    if (saved === "closed") return false;

    return Boolean(LEAGUE_SECTION_DEFAULTS[sectionKey]);
  }

  function setSectionOpen(leagueId, sectionKey, isOpen) {
    localStorage.setItem(
      sectionStorageKey(leagueId, sectionKey),
      isOpen ? "open" : "closed"
    );
  }

  function sectionHtml(leagueId, sectionKey, title, contentHtml) {
    const open = isSectionOpen(leagueId, sectionKey);

    return `
    <div class="league-section ${open ? "open" : "closed"}">
      <button class="league-section-toggle" type="button" onclick="toggleLeagueSection('${leagueId}', '${sectionKey}')">
        <span>${escapeHtml(title)}</span>
        <b>${open ? "&#9660;" : "&#9654;"}</b>
      </button>

      ${
        open
          ? `<div class="league-section-body">${contentHtml}</div>`
          : ""
      }
    </div>
  `;
  }

  window.ABALeagues = {
    LEAGUE_SECTION_DEFAULTS,
    sectionStorageKey,
    isSectionOpen,
    setSectionOpen,
    sectionHtml
  };
})();
