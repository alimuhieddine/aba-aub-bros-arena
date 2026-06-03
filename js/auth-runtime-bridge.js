// Rebind safe auth/profile helper globals to the shared auth module after app.js loads.
// Helpers that depend on app.js private state stay in app.js until the full auth extraction.
(function () {
  if (!window.ABAAuth) {
    console.warn("ABAAuth is not loaded. Keeping app.js auth helper definitions.");
    return;
  }

  window.cacheProfileAccess = window.ABAAuth.cacheProfileAccess;

  window.setProfileStatusText = function setProfileStatusText(profile) {
    const status = document.getElementById("profile-status");
    if (!status) return;

    status.textContent = window.ABAAuth.profileStatusText(profile);
  };
})();
