// Rebind safe auth/profile helper globals to the shared auth module after app.js loads.
// Helpers that depend on app.js private state stay in app.js until the full auth extraction.
(function () {
  function scriptAlreadyPresent(srcPrefix) {
    return Array.from(document.scripts).some(script => {
      const src = script.getAttribute("src") || "";
      return src.startsWith(srcPrefix);
    });
  }

  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    if (scriptAlreadyPresent(src.split("?")[0])) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  function bindAuthHelpers() {
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
  }

  async function boot() {
    try {
      await loadScript("js/auth.js?v=1", "ABAAuth");
      bindAuthHelpers();

      await Promise.all([
        loadScript("js/admin.js?v=1", "ABAAdmin"),
        loadScript("js/venues.js?v=1", "ABAVenues")
      ]);
    } catch (error) {
      console.warn(error.message);
    }
  }

  boot();
})();
