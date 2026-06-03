(() => {
  const SETTINGS_KEY = "soccer_rating_settings";
  const LOCAL_KEY = "aba_soccer_rating_settings";

  const DEFAULTS = {
    rollingAverageWindow: 20,
    minimumMatchesRequired: 10,
    defaultAverageTotalGoals: 15,
    attackConstant: 1,
    defenseConstant: 1,
    attAttackShare: 0.70,
    midAttackShare: 0.30,
    midDefenseShare: 0.15,
    defDefenseShare: 0.50,
    gkDefenseShare: 0.35,
    winModifier: 0.10,
    lossModifier: -0.10,
    maxGain: 0.35,
    maxLoss: 0.35,
    minRating: 1,
    maxRating: 10,
    formulaVersion: 1
  };

  let sharedSettings = null;
  let loadingSettings = null;

  function readLocalSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
      return saved && typeof saved === "object" ? saved : {};
    } catch {
      return {};
    }
  }

  function normalizeSettings(raw = {}, version = null) {
    const settings = {
      ...DEFAULTS,
      ...readLocalSettings(),
      ...(raw && typeof raw === "object" ? raw : {})
    };

    if (settings.midAttackWeight !== undefined && settings.midAttackShare === undefined) {
      settings.midAttackShare = Number(settings.midAttackWeight);
    }

    if (settings.midDefenseWeight !== undefined && settings.midDefenseShare === undefined) {
      settings.midDefenseShare = Number(settings.midDefenseWeight);
    }

    settings.minRating = Number.isFinite(Number(settings.minRating)) ? Number(settings.minRating) : DEFAULTS.minRating;
    settings.maxRating = Number.isFinite(Number(settings.maxRating)) ? Number(settings.maxRating) : DEFAULTS.maxRating;

    if (settings.maxRating <= settings.minRating) {
      settings.minRating = DEFAULTS.minRating;
      settings.maxRating = DEFAULTS.maxRating;
    }

    settings.formulaVersion = Number(version || settings.formulaVersion || 1);
    return settings;
  }

  async function loadSharedSoccerRatingSettings(force = false) {
    if (loadingSettings && !force) return loadingSettings;

    loadingSettings = (async () => {
      try {
        const { data, error } = await supabaseClient
          .from("app_settings")
          .select("value,version")
          .eq("key", SETTINGS_KEY)
          .maybeSingle();

        if (error) throw error;

        sharedSettings = normalizeSettings(data?.value || {}, data?.version || 1);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(sharedSettings));
      } catch (error) {
        console.warn("Using local soccer settings fallback:", error.message);
        sharedSettings = normalizeSettings(readLocalSettings());
      }

      return sharedSettings;
    })();

    return loadingSettings;
  }

  function sharedSoccerRatingSettings() {
    return normalizeSettings(sharedSettings || readLocalSettings());
  }

  function setSettingInput(id, value) {
    const input = $(id);
    if (!input) return;

    const n = Number(value);
    input.value = Number.isFinite(n) ? String(Number(n.toFixed(3))) : "";
  }

  function readSettingInput(id, fallback) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function renderSharedSoccerRatingSettingsForm() {
    if (!$("soccer-rating-settings-card")) return;

    const settings = sharedSoccerRatingSettings();

    setSettingInput("soccer-setting-rolling-window", settings.rollingAverageWindow);
    setSettingInput("soccer-setting-min-matches", settings.minimumMatchesRequired);
    setSettingInput("soccer-setting-default-total-goals", settings.defaultAverageTotalGoals);
    setSettingInput("soccer-setting-attack-constant", settings.attackConstant);
    setSettingInput("soccer-setting-defense-constant", settings.defenseConstant);
    setSettingInput("soccer-setting-att-attack-share", settings.attAttackShare);
    setSettingInput("soccer-setting-mid-attack-share", settings.midAttackShare);
    setSettingInput("soccer-setting-mid-defense-share", settings.midDefenseShare);
    setSettingInput("soccer-setting-def-defense-share", settings.defDefenseShare);
    setSettingInput("soccer-setting-gk-defense-share", settings.gkDefenseShare);
    setSettingInput("soccer-setting-win", settings.winModifier);
    setSettingInput("soccer-setting-loss", settings.lossModifier);
    setSettingInput("soccer-setting-max-gain", settings.maxGain);
    setSettingInput("soccer-setting-max-loss", settings.maxLoss);
    setSettingInput("soccer-setting-min-rating", settings.minRating);
    setSettingInput("soccer-setting-max-rating", settings.maxRating);

    if ($("soccer-settings-status")) {
      $("soccer-settings-status").textContent =
        `Shared soccer formula v${settings.formulaVersion}. Saved in Supabase.`;
    }
  }

  function settingsFromForm() {
    const settings = {
      rollingAverageWindow: Math.max(1, Math.round(readSettingInput("soccer-setting-rolling-window", DEFAULTS.rollingAverageWindow))),
      minimumMatchesRequired: Math.max(0, Math.round(readSettingInput("soccer-setting-min-matches", DEFAULTS.minimumMatchesRequired))),
      defaultAverageTotalGoals: Math.max(0, readSettingInput("soccer-setting-default-total-goals", DEFAULTS.defaultAverageTotalGoals)),
      attackConstant: readSettingInput("soccer-setting-attack-constant", DEFAULTS.attackConstant),
      defenseConstant: readSettingInput("soccer-setting-defense-constant", DEFAULTS.defenseConstant),
      attAttackShare: readSettingInput("soccer-setting-att-attack-share", DEFAULTS.attAttackShare),
      midAttackShare: readSettingInput("soccer-setting-mid-attack-share", DEFAULTS.midAttackShare),
      midDefenseShare: readSettingInput("soccer-setting-mid-defense-share", DEFAULTS.midDefenseShare),
      defDefenseShare: readSettingInput("soccer-setting-def-defense-share", DEFAULTS.defDefenseShare),
      gkDefenseShare: readSettingInput("soccer-setting-gk-defense-share", DEFAULTS.gkDefenseShare),
      winModifier: readSettingInput("soccer-setting-win", DEFAULTS.winModifier),
      lossModifier: readSettingInput("soccer-setting-loss", DEFAULTS.lossModifier),
      maxGain: Math.abs(readSettingInput("soccer-setting-max-gain", DEFAULTS.maxGain)),
      maxLoss: Math.abs(readSettingInput("soccer-setting-max-loss", DEFAULTS.maxLoss)),
      minRating: readSettingInput("soccer-setting-min-rating", DEFAULTS.minRating),
      maxRating: readSettingInput("soccer-setting-max-rating", DEFAULTS.maxRating)
    };

    const attackShareTotal = settings.attAttackShare + settings.midAttackShare;
    const defenseShareTotal = settings.midDefenseShare + settings.defDefenseShare + settings.gkDefenseShare;

    if (Object.values(settings).some(value => !Number.isFinite(Number(value)))) {
      throw new Error("All soccer formula values must be valid numbers.");
    }

    if (settings.attAttackShare < 0 || settings.midAttackShare < 0) {
      throw new Error("Attack shares cannot be negative.");
    }

    if (settings.midDefenseShare < 0 || settings.defDefenseShare < 0 || settings.gkDefenseShare < 0) {
      throw new Error("Defense shares cannot be negative.");
    }

    if (Math.abs(attackShareTotal - 1) > 0.01) {
      throw new Error("ATT attack share + MID attack share should equal 1.00.");
    }

    if (Math.abs(defenseShareTotal - 1) > 0.01) {
      throw new Error("MID defense share + DEF defense share + GK defense share should equal 1.00.");
    }

    if (settings.maxRating <= settings.minRating) {
      throw new Error("Maximum allowed rating must be higher than minimum allowed rating.");
    }

    return settings;
  }

  async function saveSharedSoccerRatingSettings() {
    if (!isCurrentUserAdmin()) {
      alert("Admin only.");
      return;
    }

    let settings;

    try {
      settings = settingsFromForm();
    } catch (error) {
      alert(error.message);
      return;
    }

    const current = await loadSharedSoccerRatingSettings(true);
    const version = Number(current.formulaVersion || 1) + 1;
    settings.formulaVersion = version;

    const { error } = await supabaseClient
      .from("app_settings")
      .upsert({
        key: SETTINGS_KEY,
        value: settings,
        version,
        updated_by: currentProfile?.id || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) {
      alert(error.message);
      return;
    }

    sharedSettings = normalizeSettings(settings, version);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sharedSettings));
    renderSharedSoccerRatingSettingsForm();

    if ($("soccer-settings-status")) {
      $("soccer-settings-status").textContent =
        `Shared soccer formula saved as v${version}. Use Maintenance Tools to recalculate old finalized matches.`;
    }

    renderMatches();
  }

  async function resetSharedSoccerRatingSettings() {
    if (!isCurrentUserAdmin()) {
      alert("Admin only.");
      return;
    }

    const ok = confirm("Reset shared soccer expected-goals formula to default values?");
    if (!ok) return;

    const current = await loadSharedSoccerRatingSettings(true);
    const version = Number(current.formulaVersion || 1) + 1;
    const settings = { ...DEFAULTS, formulaVersion: version };

    const { error } = await supabaseClient
      .from("app_settings")
      .upsert({
        key: SETTINGS_KEY,
        value: settings,
        version,
        updated_by: currentProfile?.id || null,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) {
      alert(error.message);
      return;
    }

    sharedSettings = settings;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sharedSettings));
    renderSharedSoccerRatingSettingsForm();

    if ($("soccer-settings-status")) {
      $("soccer-settings-status").textContent = `Shared soccer formula reset as v${version}.`;
    }

    renderMatches();
  }

  async function applyPositionRatingDeltaShared(memberId, sportId, positionName, delta, gamesDelta) {
    const cleanMemberId = cleanUuidValue(memberId);
    const cleanSportId = cleanUuidValue(sportId);
    const cleanPosition = normalizeSoccerPosition(positionName);

    if (!cleanMemberId || !cleanSportId || !cleanPosition) {
      console.warn("Skipping invalid position rating row:", { memberId, sportId, positionName });
      return { ok: true, skipped: true };
    }

    const settings = sharedSoccerRatingSettings();
    const existing = currentPositionRatingRow(cleanMemberId, cleanSportId, cleanPosition);
    const ratingBefore = Number(existing?.rating || positionRatingForMember(cleanMemberId, cleanSportId, cleanPosition) || 5);
    const currentGames = Number(existing?.games_played || 0);
    const ratingAfter = clampNumber(ratingBefore + Number(delta || 0), settings.minRating, settings.maxRating);
    const nextGamesPlayed = Math.max(0, currentGames + Number(gamesDelta || 0));

    const { error } = await supabaseClient
      .from("member_sport_position_ratings")
      .upsert({
        member_id: cleanMemberId,
        sport_id: cleanSportId,
        position_name: cleanPosition,
        rating: Number(ratingAfter.toFixed(2)),
        games_played: nextGamesPlayed,
        updated_at: new Date().toISOString()
      }, { onConflict: "member_id,sport_id,position_name" });

    if (error) {
      alert(error.message);
      return { ok: false };
    }

    await loadPositionRatings();
    return { ok: true, ratingBefore, ratingAfter };
  }

  async function setPositionRatingValueShared(memberId, sportId, positionName, ratingValue, gamesDelta) {
    const cleanMemberId = cleanUuidValue(memberId);
    const cleanSportId = cleanUuidValue(sportId);
    const cleanPosition = normalizeSoccerPosition(positionName);

    if (!cleanMemberId || !cleanSportId || !cleanPosition) {
      console.warn("Skipping invalid position rating rollback row:", { memberId, sportId, positionName });
      return true;
    }

    const settings = sharedSoccerRatingSettings();
    const existing = currentPositionRatingRow(cleanMemberId, cleanSportId, cleanPosition);
    const currentGames = Number(existing?.games_played || 0);
    const nextGamesPlayed = Math.max(0, currentGames + Number(gamesDelta || 0));
    const nextRating = clampNumber(Number(ratingValue || 5), settings.minRating, settings.maxRating);

    const { error } = await supabaseClient
      .from("member_sport_position_ratings")
      .upsert({
        member_id: cleanMemberId,
        sport_id: cleanSportId,
        position_name: cleanPosition,
        rating: Number(nextRating.toFixed(2)),
        games_played: nextGamesPlayed,
        updated_at: new Date().toISOString()
      }, { onConflict: "member_id,sport_id,position_name" });

    if (error) {
      alert(error.message);
      return false;
    }

    await loadPositionRatings();
    return true;
  }

  function dedupeSoccerRatingRowsByPosition(rows) {
    const byKey = new Map();
    const settings = sharedSoccerRatingSettings();

    (rows || []).forEach(row => {
      const memberId = cleanUuidValue(row.member_id);
      const sportId = cleanUuidValue(row.sport_id);
      const position = normalizeSoccerPosition(row.position_name);

      if (!memberId || !sportId || !position) return;

      const key = `${memberId}|${sportId}|${position}`;
      const nextAdjustment = Number(row.adjustment || 0);
      const current = byKey.get(key);

      if (!current || Math.abs(nextAdjustment) > Math.abs(Number(current.adjustment || 0))) {
        byKey.set(key, {
          member_id: memberId,
          sport_id: sportId,
          position_name: position,
          adjustment: clampNumber(nextAdjustment, -Math.abs(settings.maxLoss), Math.abs(settings.maxGain))
        });
      }
    });

    return Array.from(byKey.values());
  }

  async function saveMatchPositionRatingAdjustmentRowShared(row) {
    const settings = sharedSoccerRatingSettings();
    const cleanRow = {
      match_id: cleanUuidValue(row.match_id),
      member_id: cleanUuidValue(row.member_id),
      sport_id: cleanUuidValue(row.sport_id),
      position_name: normalizeSoccerPosition(row.position_name),
      adjustment: Number(row.adjustment || 0),
      rating_before: Number(row.rating_before || 0),
      rating_after: Number(row.rating_after || 0),
      formula_version: Number(settings.formulaVersion || 1),
      settings_snapshot: settings
    };

    if (!cleanRow.match_id || !cleanRow.member_id || !cleanRow.sport_id || !cleanRow.position_name) {
      console.warn("Skipping invalid rating adjustment row:", row);
      return true;
    }

    const { error } = await supabaseClient
      .from("match_position_rating_adjustments")
      .upsert(cleanRow, { onConflict: "match_id,member_id,sport_id,position_name" });

    if (error) {
      alert(error.message);
      return false;
    }

    return true;
  }

  function chronological(matches) {
    return [...(matches || [])].sort((a, b) => soccerMatchDateValue(a) - soccerMatchDateValue(b));
  }

  async function recalculateAllSoccerRatingsChronological() {
    if (!isCurrentUserAdmin()) {
      alert("Admin only.");
      return;
    }

    await loadSharedSoccerRatingSettings(true);

    const matches = chronological(finalizedRecalculableMatches().filter(match => isSoccerMatch(match)));

    if (!matches.length) {
      alert("No finalized soccer matches found.");
      return;
    }

    const ok = confirm(`Recalculate soccer ratings for ${matches.length} finalized soccer match(es), oldest to newest?`);
    if (!ok) return;

    for (const match of matches) {
      const saved = await recalculateMatchSoccerRatings(match, false);
      if (!saved) return;
    }

    alert("All finalized soccer ratings recalculated chronologically.");
    await loadPositionRatings();
    await loadMatches();
    renderRankings();
    renderLeagues();
  }

  async function recalculateAllFinalizedMatchesChronological() {
    if (!isCurrentUserAdmin()) {
      alert("Admin only.");
      return;
    }

    await loadSharedSoccerRatingSettings(true);

    const matches = chronological(finalizedRecalculableMatches());

    if (!matches.length) {
      alert("No finalized matches found.");
      return;
    }

    const ok = confirm(`Recalculate points and soccer ratings for ${matches.length} finalized match(es), oldest to newest?`);
    if (!ok) return;

    for (const match of matches) {
      const pointsOk = await saveMatchMemberPoints(match);
      if (!pointsOk) return;

      if (isSoccerMatch(match)) {
        const ratingsOk = await recalculateMatchSoccerRatings(match, false);
        if (!ratingsOk) return;
      }
    }

    alert("All finalized matches recalculated chronologically.");
    await loadPositionRatings();
    await loadMatches();
    renderRankings();
    renderLeagues();
  }

  function interceptClick(id, handler) {
    const button = $(id);
    if (!button) return;

    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  soccerRatingSettings = sharedSoccerRatingSettings;
  renderSoccerRatingSettingsForm = renderSharedSoccerRatingSettingsForm;
  saveSoccerRatingSettings = saveSharedSoccerRatingSettings;
  resetSoccerRatingSettings = resetSharedSoccerRatingSettings;
  applyPositionRatingDelta = applyPositionRatingDeltaShared;
  setPositionRatingValue = setPositionRatingValueShared;
  dedupeSoccerRatingRows = dedupeSoccerRatingRowsByPosition;
  saveMatchPositionRatingAdjustmentRow = saveMatchPositionRatingAdjustmentRowShared;
  recalculateAllSoccerRatings = recalculateAllSoccerRatingsChronological;
  recalculateAllFinalizedMatches = recalculateAllFinalizedMatchesChronological;

  interceptClick("save-soccer-settings-btn", saveSharedSoccerRatingSettings);
  interceptClick("reset-soccer-settings-btn", resetSharedSoccerRatingSettings);
  interceptClick("recalc-all-soccer-ratings-btn", recalculateAllSoccerRatingsChronological);
  interceptClick("recalc-all-finalized-btn", recalculateAllFinalizedMatchesChronological);

  loadSharedSoccerRatingSettings().then(renderSharedSoccerRatingSettingsForm);
})();
