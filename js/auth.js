// Auth/profile helpers for the gradual app.js split.
// This file is intentionally non-breaking: it exposes ABAAuth without replacing app.js functions yet.
(function () {
  const ACCESS_CACHE_KEY = "aba_user_access";
  const DEFAULT_MEMBER_ROLE = "member";
  const DEFAULT_APPROVAL_STATUS = "pending";
  const EMAIL_REDIRECT_URL = "https://alimuhieddine.github.io/aba-aub-bros-arena/";

  function normalizeProfile(profile) {
    return profile && typeof profile === "object" ? profile : null;
  }

  function approvalStatus(profile) {
    return normalizeProfile(profile)?.approval_status || DEFAULT_APPROVAL_STATUS;
  }

  function role(profile) {
    return normalizeProfile(profile)?.role || DEFAULT_MEMBER_ROLE;
  }

  function isApprovedProfile(profile) {
    return approvalStatus(profile) === "approved";
  }

  function isAdminProfile(profile) {
    return role(profile) === "admin" && isApprovedProfile(profile);
  }

  function isRestrictedProfile(profile) {
    const status = approvalStatus(profile);
    return !profile || status === "pending" || status === "rejected" || status === "suspended";
  }

  function accessSnapshot(profile) {
    if (!profile) return null;

    return {
      role: role(profile),
      approval_status: approvalStatus(profile)
    };
  }

  function cacheProfileAccess(profile) {
    const snapshot = accessSnapshot(profile);

    if (!snapshot) {
      localStorage.removeItem(ACCESS_CACHE_KEY);
      return null;
    }

    localStorage.setItem(ACCESS_CACHE_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  function cachedProfileAccess() {
    try {
      return JSON.parse(localStorage.getItem(ACCESS_CACHE_KEY) || "null");
    } catch {
      localStorage.removeItem(ACCESS_CACHE_KEY);
      return null;
    }
  }

  function clearCachedProfileAccess() {
    localStorage.removeItem(ACCESS_CACHE_KEY);
  }

  function profileStatusText(profile) {
    if (!profile) return "Complete your profile, then wait for admin approval.";

    const status = approvalStatus(profile);
    const profileRole = role(profile);

    if (status === "pending") return "Your profile is waiting for admin approval.";
    if (status === "rejected") return "Your registration was rejected. Please contact an admin if you think this is a mistake.";
    if (status === "suspended") return "Your account is suspended. Please contact an admin.";

    return `Status: ${status} • Role: ${profileRole}`;
  }

  window.ABAAuth = {
    ACCESS_CACHE_KEY,
    EMAIL_REDIRECT_URL,
    approvalStatus,
    role,
    isApprovedProfile,
    isAdminProfile,
    isRestrictedProfile,
    accessSnapshot,
    cacheProfileAccess,
    cachedProfileAccess,
    clearCachedProfileAccess,
    profileStatusText
  };
})();
