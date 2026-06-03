// Admin helpers for the gradual app.js split.
// This module is non-breaking and does not replace app.js behavior yet.
(function () {
  function auth() {
    return window.ABAAuth || {};
  }

  function isAdminProfile(profile) {
    return Boolean(auth().isAdminProfile?.(profile));
  }

  function canReviewMembers(profile) {
    return isAdminProfile(profile);
  }

  function memberReviewPayload(decision, reviewerId) {
    return {
      approval_status: decision,
      registration_status: decision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId
    };
  }

  function pendingMemberSelect() {
    return "id,first_name,last_name,display_name,email,phone,birth_date,approval_status,created_at";
  }

  function adminOnlySelector() {
    return ".admin-only";
  }

  window.ABAAdmin = {
    isAdminProfile,
    canReviewMembers,
    memberReviewPayload,
    pendingMemberSelect,
    adminOnlySelector
  };
})();
