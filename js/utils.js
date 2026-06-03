// Shared utility helpers for the gradual app.js split.
// Functions are attached to window so existing inline handlers and scripts can keep using globals.
(function () {
  function cleanUuidValue(value) {
    if (value === null || value === undefined) return null;

    const text = String(value).trim();

    if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") {
      return null;
    }

    return text;
  }

  function isValidUuidValue(value) {
    return Boolean(cleanUuidValue(value));
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"]/g, s => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;"
    }[s]));
  }

  function jsString(str) {
    return String(str ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "");
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function averageValues(values, fallback = 5) {
    const clean = (values || []).filter(value => Number.isFinite(Number(value)));

    if (!clean.length) return fallback;

    return clean.reduce((sum, value) => sum + Number(value), 0) / clean.length;
  }

  window.ABAUtils = {
    cleanUuidValue,
    isValidUuidValue,
    escapeHtml,
    jsString,
    fmtDate,
    clampNumber,
    averageValues
  };

  window.cleanUuidValue = window.cleanUuidValue || cleanUuidValue;
  window.isValidUuidValue = window.isValidUuidValue || isValidUuidValue;
  window.escapeHtml = window.escapeHtml || escapeHtml;
  window.jsString = window.jsString || jsString;
  window.fmtDate = window.fmtDate || fmtDate;
  window.clampNumber = window.clampNumber || clampNumber;
  window.averageValues = window.averageValues || averageValues;
})();
