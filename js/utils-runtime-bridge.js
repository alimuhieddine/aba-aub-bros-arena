// Rebind helper globals to the shared utility module after app.js loads.
// This lets us prove the extracted helpers at runtime before deleting duplicates from app.js.
(function () {
  if (!window.ABAUtils) {
    console.warn("ABAUtils is not loaded. Keeping app.js helper definitions.");
    return;
  }

  window.cleanUuidValue = window.ABAUtils.cleanUuidValue;
  window.isValidUuidValue = window.ABAUtils.isValidUuidValue;
  window.escapeHtml = window.ABAUtils.escapeHtml;
  window.jsString = window.ABAUtils.jsString;
  window.fmtDate = window.ABAUtils.fmtDate;
  window.clampNumber = window.ABAUtils.clampNumber;
  window.averageValues = window.ABAUtils.averageValues;
})();
