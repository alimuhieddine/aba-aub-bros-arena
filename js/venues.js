// Venue helpers for the gradual app.js split.
// This module is non-breaking and does not replace app.js behavior yet.
(function () {
  function utils() {
    return window.ABAUtils || {};
  }

  function escapeHtml(value) {
    return utils().escapeHtml ? utils().escapeHtml(value) : String(value ?? "");
  }

  function venueSelect() {
    return `
      id,
      name,
      address,
      google_maps_url,
      image_url,
      is_active,
      created_at,
      venue_sports (
        sport_id,
        sports (
          id,
          name
        )
      )
    `;
  }

  function venuePayload({ name, address, googleMapsUrl, imageUrl }) {
    return {
      name: String(name || "").trim(),
      address: String(address || "").trim(),
      google_maps_url: String(googleMapsUrl || "").trim(),
      image_url: String(imageUrl || "").trim()
    };
  }

  function venueSportRows(venueId, sportIds) {
    return (sportIds || []).filter(Boolean).map(sportId => ({
      venue_id: venueId,
      sport_id: sportId
    }));
  }

  function sportNamesForVenue(venue) {
    return (venue?.venue_sports || [])
      .map(row => row.sports?.name)
      .filter(Boolean);
  }

  function sportIdsForVenue(venue) {
    return (venue?.venue_sports || [])
      .map(row => row.sport_id)
      .filter(Boolean);
  }

  function venueStatusText(venue) {
    return venue?.is_active ? "Active" : "Inactive";
  }

  function venueStatusClass(venue) {
    return venue?.is_active ? "green" : "red";
  }

  function venueOptionLabel(venue) {
    const name = venue?.name || "Unnamed venue";
    const address = venue?.address ? ` - ${venue.address}` : "";
    return `${name}${address}`;
  }

  function mapLinkHtml(url) {
    if (!url) return "";
    return `<div class="meta"><a href="${escapeHtml(url)}" target="_blank">Open Map</a></div>`;
  }

  window.ABAVenues = {
    venueSelect,
    venuePayload,
    venueSportRows,
    sportNamesForVenue,
    sportIdsForVenue,
    venueStatusText,
    venueStatusClass,
    venueOptionLabel,
    mapLinkHtml
  };
})();
