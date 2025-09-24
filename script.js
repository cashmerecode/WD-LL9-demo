// Skullcapz Dev Lab — Artist Utilities
// Features: theme toggle, nav, toasts, modal, setlist (copy/download),
// countdowns (editable + persist), VIP picker, voting (persist + share),
// tour spotlight + next stop (persist), email validation, bio toggle.

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- App boot ----
  document.documentElement.classList.remove("no-js");
  $("#year").textContent = new Date().getFullYear();

  // ---- Toasts ----
  const toasts = $("#toasts");
  function toast(msg, ms = 2200) {
    if (!toasts) return;
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    toasts.appendChild(div);
    setTimeout(() => div.classList.add("show"), 10);
    setTimeout(() => {
      div.classList.remove("show");
      setTimeout(() => div.remove(), 300);
    }, ms);
  }

  // ---- Modal (native <dialog>) ----
  const modal = $("#appModal");
  function openModal(title, innerHTML) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = innerHTML;
    modal?.showModal();
  }

  // ---- Theme toggle (persist) ----
  const THEME_KEY = "skull_theme";
  const themeToggle = $("#themeToggle");
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) document.documentElement.classList.toggle("theme-light", savedTheme === "light");
  themeToggle?.addEventListener("click", () => {
    const light = document.documentElement.classList.toggle("theme-light");
    localStorage.setItem(THEME_KEY, light ? "light" : "dark");
    toast(light ? "Light theme on" : "Dark theme on");
  });

  // ---- Nav toggle (mobile) ----
  const navToggle = $("#navToggle");
  const siteNav = $("#siteNav");
  navToggle?.addEventListener("click", () => {
    const open = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  siteNav?.addEventListener("click", e => {
    if (e.target.matches("a")) siteNav.classList.remove("open");
  });

  // ------------------------------------------------------------
  // 1) SETLIST GENERATOR + COPY/DOWNLOAD
  // ------------------------------------------------------------
  const DEFAULT_SONGS = [
    "Thunder Skull","Cap Attack","Midnight Riot","Echoes in Chrome",
    "Final Encore","Silver Static","Neon Howl"
  ];
  const setlistEl = $("#setlist");
  const seedInput = $("#songSeed");
  $("#generateSetlist")?.addEventListener("click", () => {
    const custom = (seedInput?.value || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    const songs = [...DEFAULT_SONGS, ...custom];
    const shuffled = fisherYates(songs);
    setlistEl.innerHTML = shuffled.map(s => `<li>${escapeHTML(s)}</li>`).join("");
    if (!prefersReduced) flash(setlistEl);
  });

  $("#copySetlist")?.addEventListener("click", async () => {
    const items = [...setlistEl.querySelectorAll("li")].map(li => li.textContent);
    if (!items.length) return toast("Generate a setlist first");
    const text = items.map((s, i) => `${i + 1}. ${s}`).join("\n");
    await navigator.clipboard.writeText(text);
    toast("Setlist copied");
  });

  $("#downloadSetlist")?.addEventListener("click", () => {
    const items = [...setlistEl.querySelectorAll("li")].map(li => li.textContent);
    if (!items.length) return toast("Generate a setlist first");
    const blob = new Blob([items.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "skullcapz-setlist.txt" });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast("Downloaded setlist.txt");
  });

  // ------------------------------------------------------------
  // 2) COUNTDOWN TIMER (editable + persist)
  // ------------------------------------------------------------
  const COUNT_KEY = "skull_kickoff";
  const countdownOut = $("#countdown");
  const inputKick = $("#kickoffInput");
  const savedKick = localStorage.getItem(COUNT_KEY);
  if (savedKick) inputKick.value = savedKick;

  let targetDate = inputKick.value ? new Date(inputKick.value) : null;

  $("#timer-section")?.classList.remove("hidden");
  function updateCountdown() {
    if (!countdownOut) return;
    if (!targetDate || isNaN(+targetDate)) {
      countdownOut.textContent = "Set a kickoff date/time.";
      return;
    }
    const diff = targetDate - new Date();
    if (diff <= 0) { countdownOut.textContent = "Showtime! 🤘"; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff / 3600000) % 24);
    const m = Math.floor((diff / 60000) % 60);
    const s = Math.floor((diff / 1000) % 60);
    countdownOut.textContent = `${d}d ${h}h ${m}m ${s}s`;
  }
  setInterval(updateCountdown, 1000);
  updateCountdown();

  $("#countdownForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const val = inputKick.value;
    if (!val) return toast("Pick a date/time first");
    targetDate = new Date(val);
    localStorage.setItem(COUNT_KEY, val);
    updateCountdown();
    toast("Countdown set");
  });

  // ------------------------------------------------------------
  // 3) VIP TICKET WINNER
  // ------------------------------------------------------------
  $("#vipPick")?.addEventListener("click", () => {
    const names = ($("#vipInput")?.value || "")
      .split(",").map(n => n.trim()).filter(Boolean);
    const out = $("#vipResult");
    if (!names.length) { out.textContent = "Enter at least one name."; return; }
    const winner = names[Math.floor(Math.random() * names.length)];
    out.textContent = `Winner: ${winner} 🎉`;
    openModal("VIP Winner", `<p style="font-size:1.25rem"><strong>${escapeHTML(winner)}</strong></p>`);
  });
  $("#vipClear")?.addEventListener("click", () => { $("#vipInput").value = ""; $("#vipResult").textContent = ""; });

  // ------------------------------------------------------------
  // 4) FAN FAVORITE SHOWDOWN (localStorage + share)
  // ------------------------------------------------------------
  const VOTE_KEY = "skull_votes_v1";
  const voteState = loadJSON(VOTE_KEY, { "Neon Howl": 0, "Echoes in Chrome": 0 });
  for (const song of Object.keys(voteState)) {
    const span = $(`#v-${CSS.escape(song)}`);
    if (span) span.textContent = voteState[song];
  }
  $("#voteFeature")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".vote");
    if (btn) {
      const song = btn.getAttribute("data-song");
      voteState[song] = (voteState[song] || 0) + 1;
      $(`#v-${CSS.escape(song)}`).textContent = voteState[song];
      saveJSON(VOTE_KEY, voteState);
      if (!prefersReduced) flash(btn);
    }
    if (e.target.id === "voteReset") {
      Object.keys(voteState).forEach(k => voteState[k] = 0);
      $$("#voteFeature .counter").forEach(s => s.textContent = "0");
      saveJSON(VOTE_KEY, voteState);
      toast("Votes reset");
    }
    if (e.target.id === "voteShare") {
      const text = `Fan Favorite — Neon Howl: ${voteState["Neon Howl"]} | Echoes in Chrome: ${voteState["Echoes in Chrome"]}`;
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); toast("Results copied"); }
      } catch {}
    }
  });

  // ------------------------------------------------------------
  // 5) TOUR DATE SPOTLIGHT + NEXT STOP (persist)
  // ------------------------------------------------------------
  const CITY_KEY = "skull_cities_v1";
  const STOP_KEY = "skull_stops_v1";
  const cities = loadJSON(CITY_KEY, [
    { city: "Las Vegas, NV", venue: "Fremont Hall", date: "2025-10-05" },
    { city: "Phoenix, AZ", venue: "Cactus Arena", date: "2025-10-12" },
    { city: "Los Angeles, CA", venue: "Echo Dome", date: "2025-10-19" }
  ]);
  const stops = loadJSON(STOP_KEY, [
    { city: "San Diego, CA", date: "2025-10-01" },
    { city: "San Jose, CA", date: "2025-10-08" },
    { city: "Portland, OR", date: "2025-10-15" },
    { city: "Seattle, WA", date: "2025-10-22" }
  ]);

  const cityList = $("#cityList");
  const cityDetail = $("#cityDetail");
  if (cityList) {
    cityList.innerHTML = cities.map((c, i) =>
      `<li><button class="btn ghost pill" data-idx="${i}">${escapeHTML(c.city)}</button></li>`
    ).join("");
    cityList.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-idx]");
      if (!b) return;
      const c = cities[+b.dataset.idx];
      cityDetail.innerHTML = `<strong>${escapeHTML(c.venue)}</strong> — ${new Date(c.date).toDateString()}`;
      if (!prefersReduced) flash(cityDetail);
    });
  }

  function computeNextStop() {
    const now = new Date();
    const up = stops
      .map(s => ({ ...s, when: new Date(s.date) }))
      .filter(s => s.when >= now)
      .sort((a, b) => a.when - b.when)[0];
    $("#nextStop").textContent = up ? `${up.city} — ${up.when.toDateString()}` : "Tour completed!";
  }
  computeNextStop();
  $("#recalcStop")?.addEventListener("click", computeNextStop);

  $("#addStop")?.addEventListener("click", () => {
    openModal("Add Tour Stop", `
      <label class="label">City<input id="mCity" class="input" type="text" placeholder="City, ST"></label>
      <label class="label">Date<input id="mDate" class="input" type="date"></label>
    `);
    modal.addEventListener("close", () => {
      if (modal.returnValue !== "ok") return;
      const city = $("#mCity")?.value?.trim();
      const date = $("#mDate")?.value?.trim();
      if (!city || !date) return toast("City & date required");
      stops.push({ city, date });
      saveJSON(STOP_KEY, stops);
      computeNextStop();
      toast("Stop added");
    }, { once: true });
  });

  // ------------------------------------------------------------
  // 6) EMAIL VALIDATION
  // ------------------------------------------------------------
  $("#emailValidate")?.addEventListener("click", () => {
    const email = ($("#emailInput")?.value || "").trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const msg = $("#emailMsg");
    msg.textContent = ok ? "Looks valid ✅" : "Invalid email ❌";
    msg.classList.toggle("good", ok);
    msg.classList.toggle("bad", !ok);
  });

  // ------------------------------------------------------------
  // 7) BAND BIO TOGGLE
  // ------------------------------------------------------------
  $("#bioBtn")?.addEventListener("click", () => {
    const p = $("#bioText");
    const hidden = p.classList.toggle("hidden");
    p.setAttribute("aria-hidden", String(hidden));
    $("#bioBtn").textContent = hidden ? "Show Bio" : "Hide Bio";
    if (!hidden && !prefersReduced) flash(p);
  });

  // ---- helpers ----
  function fisherYates(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function flash(el) {
    el.classList.remove("fx");
    // reflow
    void el.offsetWidth;
    el.classList.add("fx");
  }
  function escapeHTML(s) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return s.replace(/[&<>"']/g, m => map[m]);
  }
  function loadJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
})();
