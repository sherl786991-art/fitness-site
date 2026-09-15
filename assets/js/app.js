(function () {
  "use strict";

  var STORE_KEY = "fitness-plan.v1";
  var CHECK_KEY = "fitness-plan.checkins.v1";
  var THEME_KEY = "fitness-plan.theme.v1";
  var SCHED_KEY = "fitness-plan.schedule.v1";
  var BASE_TITLE = document.title;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- 工具 ---------- */

  function esc(value) {
    return String(value).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* 激励语：每天换一条，按本地日期零点切换 */
  function localDayIndex(len) {
    var now = new Date();
    var days = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
    return ((Math.floor(days) % len) + len) % len;
  }

  function facts(list) {
    return '<div class="ex-facts">' + list.map(function (item) {
      return '<span class="fact">' + esc(item[0]) + ' <b>' + esc(item[1]) + "</b></span>";
    }).join("") + "</div>";
  }

  /* ---------- 配色 ---------- */

  var THEMES = [
    { id: "white", name: "白", meta: "#fbfaf8", dot: "linear-gradient(135deg,#ffffff 0 50%,#e04a2f 50% 100%)" },
    { id: "black", name: "黑", meta: "#0f0e0d", dot: "linear-gradient(135deg,#1b1a18 0 50%,#ff6a4d 50% 100%)" },
    { id: "gray", name: "灰", meta: "#f0f0ee", dot: "linear-gradient(135deg,#ffffff 0 50%,#4b5563 50% 100%)" },
    { id: "pink", name: "粉", meta: "#fff6f8", dot: "linear-gradient(135deg,#ffffff 0 50%,#e0417a 50% 100%)" },
    { id: "blue", name: "蓝", meta: "#f5f8fe", dot: "linear-gradient(135deg,#ffffff 0 50%,#2563eb 50% 100%)" }
  ];
  var themeId = "white";

  function themeById(id) {
    return THEMES.filter(function (item) { return item.id === id; })[0];
  }

  function loadTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY);
      if (saved && themeById(saved)) { return saved; }
    } catch (err) { /* 忽略 */ }
    try {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) { return "black"; }
    } catch (err) { /* 忽略 */ }
    return "white";
  }

  function applyTheme(id, persist) {
    var theme = themeById(id) || THEMES[0];
    themeId = theme.id;
    document.documentElement.setAttribute("data-theme", theme.id);
    var meta = $('meta[name="theme-color"]');
    if (meta) { meta.setAttribute("content", theme.meta); }
    $$("#themeRow .theme-chip").forEach(function (chip) {
      chip.classList.toggle("is-on", chip.getAttribute("data-theme-id") === theme.id);
    });
    var nameEl = $("#themeName");
    if (nameEl) { nameEl.textContent = theme.name; }
    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme.id); } catch (err) { /* 忽略 */ }
    }
  }

  /* ---------- 完成进度（按训练内容存，比如 mon / tue） ---------- */

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var data = raw ? JSON.parse(raw) : null;
      return data && typeof data === "object" ? data : {};
    } catch (err) {
      return {};
    }
  }

  var progress = loadProgress();

  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (err) { /* 忽略 */ }
  }

  function isDone(dayId, index) {
    return Boolean(progress[dayId] && progress[dayId][index]);
  }

  function setDone(dayId, index, value) {
    progress[dayId] = progress[dayId] || {};
    if (value) { progress[dayId][index] = true; } else { delete progress[dayId][index]; }
    saveProgress();
  }

  function doneCount(day) {
    if (!day || !day.exercises) { return 0; }
    return day.exercises.filter(function (_, i) { return isDone(day.id, i); }).length;
  }

  function totalSets(day) {
    if (!day || !day.exercises) { return 0; }
    return day.exercises.reduce(function (sum, ex) { return sum + ex.sets; }, 0);
  }

  /* ---------- 打卡记录 ---------- */

  function loadCheckins() {
    try {
      var raw = localStorage.getItem(CHECK_KEY);
      var data = raw ? JSON.parse(raw) : null;
      return data && typeof data === "object" ? data : {};
    } catch (err) {
      return {};
    }
  }

  var checkins = loadCheckins();

  function saveCheckins() {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(checkins)); } catch (err) { /* 忽略 */ }
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function keyOfToday() { return dateKey(new Date()); }

  function isChecked(key) { return Boolean(checkins[key]); }

  function setChecked(key, value) {
    if (value) { checkins[key] = true; } else { delete checkins[key]; }
    saveCheckins();
  }

  function checkinTotal() { return Object.keys(checkins).length; }

  function checkinStreak() {
    var streak = 0;
    var cursor = new Date();
    if (!isChecked(dateKey(cursor))) { cursor.setDate(cursor.getDate() - 1); }
    while (isChecked(dateKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function checkinWeekCount() {
    var now = new Date();
    var offset = (now.getDay() + 6) % 7;
    var count = 0;
    for (var i = 0; i <= offset; i++) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      if (isChecked(dateKey(d))) { count++; }
    }
    return count;
  }

  /* ---------- 训练顺序（周一…周日分别练什么） ---------- */

  var SLOT_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  var DEFAULT_SCHEDULE = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  function dayById(id) {
    return PLAN.filter(function (day) { return day.id === id; })[0];
  }

  function loadSchedule() {
    try {
      var raw = localStorage.getItem(SCHED_KEY);
      var arr = raw ? JSON.parse(raw) : null;
      if (Object.prototype.toString.call(arr) === "[object Array]" &&
          arr.length === SLOT_LABELS.length &&
          arr.every(function (id) { return Boolean(dayById(id)); })) {
        return arr.slice();
      }
    } catch (err) { /* 忽略 */ }
    return DEFAULT_SCHEDULE.slice();
  }

  var schedule = loadSchedule();

  function saveSchedule() {
    try { localStorage.setItem(SCHED_KEY, JSON.stringify(schedule)); } catch (err) { /* 忽略 */ }
  }

  function todaySlot() { return (new Date().getDay() + 6) % 7; }

  function dayForSlot(slot) { return dayById(schedule[slot]) || PLAN[0]; }

  function trainingDays() {
    return schedule.filter(function (id) {
      var day = dayById(id);
      return Boolean(day && day.exercises);
    }).length;
  }

  function splitText() {
    var train = trainingDays();
    return train + " 练 " + (7 - train) + " 休";
  }

  var activeSlot = todaySlot();
  var activeDay = dayForSlot(activeSlot);
  var expandAll = false;

  /* ---------- 顶部统计 ---------- */

  function renderHeroStats() {
    var train = trainingDays();
    $("#heroStats").innerHTML = HERO_STATS.map(function (stat) {
      var value = stat.label === "训练频率" ? "每周 " + train + " 练 " + (7 - train) + " 休" : stat.value;
      return "<div><dt>" + esc(stat.label) + "</dt><dd>" + esc(value) + "</dd></div>";
    }).join("");
    var eyebrow = $("#coverEyebrow");
    if (eyebrow) { eyebrow.textContent = splitText() + " · 渐进超负荷"; }
  }

  /* ---------- 分栏导航 ---------- */

  var TABS = {
    plan: { title: "周计划", hash: ["plan", "top"] },
    prep: { title: "热身拉伸", hash: ["prep", "warmup", "stretch"] },
    rules: { title: "原则", hash: ["rules"] },
    track: { title: "计时打卡", hash: ["track", "timer"] }
  };
  var activeTab = "plan";

  function tabFromHash() {
    var hash = (location.hash || "").replace(/^#/, "");
    for (var id in TABS) {
      if (TABS[id].hash.indexOf(hash) >= 0) { return id; }
    }
    return "plan";
  }

  function syncAppBar() {
    var titleEl = $("#appBarTitle");
    if (titleEl) { titleEl.textContent = TABS[activeTab].title; }
    var noteEl = $("#appBarNote");
    if (noteEl) {
      noteEl.textContent = activeTab === "plan"
        ? SLOT_LABELS[activeSlot] + " · " + activeDay.part
        : "";
    }
  }

  function switchTab(id, keepScroll) {
    if (!TABS[id]) { id = "plan"; }
    activeTab = id;
    $$(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-tab") !== id;
    });
    $$("#tabbar .tab-item").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === id;
      btn.classList.toggle("is-on", on);
      if (on) { btn.setAttribute("aria-current", "page"); } else { btn.removeAttribute("aria-current"); }
    });
    syncAppBar();
    if (!keepScroll) { window.scrollTo(0, 0); }
    if (("#" + id) !== location.hash) {
      try { history.replaceState(null, "", "#" + id); } catch (err) { /* 忽略 */ }
    }
    paintRestBar();
  }

  /* ---------- 星期方格 ---------- */

  function slotMeta(day) {
    if (day.exercises) {
      return day.exercises.length + " 个动作 · " + doneCount(day) + "/" + day.exercises.length;
    }
    if (day.id === "sun") { return "完全休息"; }
    return day.duration || "清单";
  }

  function renderDayGrid() {
    var today = todaySlot();
    $("#dayGrid").innerHTML = SLOT_LABELS.map(function (label, slot) {
      var day = dayForSlot(slot);
      var allDone = day.exercises && doneCount(day) === day.exercises.length;
      return '<button type="button" class="day-cell' + (day.id === "sun" ? " is-rest" : "") +
        '" role="tab" data-slot="' + slot + '" aria-selected="' + (slot === activeSlot ? "true" : "false") + '">' +
        '<span class="day-cell-top"><b>' + esc(label) + "</b>" +
          (slot === today ? '<span class="day-cell-today">今天</span>' : "") +
        "</span>" +
        '<span class="day-cell-part">' + esc(day.part) + "</span>" +
        '<span class="day-cell-meta">' + esc(slotMeta(day)) +
          (allDone ? '<span class="dot"></span>' : "") +
        "</span></button>";
    }).join("");
  }

  /* ---------- 动作卡片 ---------- */

  function exerciseHtml(ex, index, dayId) {
    var done = isDone(dayId, index);
    var open = expandAll;
    return '<article class="exercise' + (open ? " is-open" : "") + (done ? " is-done" : "") +
      '" data-index="' + index + '">' +
      '<button type="button" class="ex-head' + (ex.img ? " has-thumb" : "") + '" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="ex-index">' + pad(index + 1) + "</span>" +
        (ex.img ? '<img class="ex-thumb" src="' + ex.img + '" alt="" width="112" height="84" loading="lazy">' : "") +
        "<span><span class=\"ex-name\">" + esc(ex.name) + "</span>" +
        '<span class="ex-sub">' + esc(ex.en) + " · 目标 " + esc(ex.target) + "</span></span>" +
        '<span class="ex-dose">' + ex.sets + " × " + esc(ex.reps.replace(/\s*次$/, "")) + "</span>" +
      "</button>" +
      '<div class="ex-body">' +
        (ex.img
          ? '<figure class="ex-figure"><img src="' + ex.img + '" alt="' + esc(ex.name) + ' 动作示意：起始位与顶峰位" width="448" height="336" loading="lazy"></figure>'
          : "") +
        facts([["组数", ex.sets + " 组"], ["每组", ex.reps], ["组间休息", ex.rest], ["动作节奏", ex.tempo], ["目标", ex.target]]) +
        '<p class="ex-section-title">动作要领</p>' +
        '<ol class="cues">' + ex.cues.map(function (cue) { return "<li>" + esc(cue) + "</li>"; }).join("") + "</ol>" +
        '<p class="ex-section-title">常见错误</p>' +
        '<ul class="mistakes">' + ex.mistakes.map(function (item) { return "<li>" + esc(item) + "</li>"; }).join("") + "</ul>" +
        '<p class="tip"><b>提示</b>' + esc(ex.tip) + "</p>" +
        '<div class="ex-foot">' +
          '<button type="button" class="check" data-act="done"><span class="box"></span>' + (done ? "已完成" : "标记完成") + "</button>" +
          '<button type="button" class="rest-btn" data-act="rest" data-sec="' + parseInt(ex.rest, 10) + '">开始 ' + esc(ex.rest) + "间歇</button>" +
        "</div>" +
      "</div></article>";
  }

  function blockHtml(title, note, body, extraClass) {
    return '<div class="block ' + (extraClass || "") + '"><h4>' + esc(title) +
      (note ? "<em>" + esc(note) + "</em>" : "") + "</h4>" + body + "</div>";
  }

  function plainList(items) {
    return '<ul class="plain-list">' + items.map(function (item) {
      return "<li><b>" + esc(item.name) + "</b><p>" + esc(item.detail) + "</p></li>";
    }).join("") + "</ul>";
  }

  /* ---------- 当天面板 ---------- */

  function renderDay(slot) {
    activeSlot = slot;
    activeDay = dayForSlot(slot);
    var day = activeDay;
    var html = "";

    html += '<div class="day-head">' +
      '<div><div class="day-title"><h3>' + esc(day.part) + '</h3><span class="day-tag">' + esc(SLOT_LABELS[slot]) + "</span></div>" +
      '<p class="day-tagline">' + esc(day.tagline) + "</p></div>" +
      '<div class="day-meta">' +
        "<span>单次时长 <b>" + esc(day.duration) + "</b></span>" +
        "<span>组间休息 <b>" + esc(day.rest) + "</b></span>" +
        (day.exercises ? "<span>动作 <b>" + day.exercises.length + "</b></span><span>总组数 <b>" + totalSets(day) + "</b></span>" : "") +
      "</div></div>";

    if (day.exercises) {
      html += '<div class="progress"><span class="progress-track"><span class="progress-fill" id="dayFill"></span></span>' +
        '<span id="dayText">已完成 0 / ' + day.exercises.length + "</span></div>";
    }

    if (day.warmup) {
      html += blockHtml("训练前热身", "约 8 分钟", plainList(day.warmup));
    }

    if (day.exercises) {
      html += '<div class="block"><h4>正式训练<em>' + day.exercises.length + " 个动作 · " + totalSets(day) +
        " 组</em><span class=\"toolbar\">" +
        '<button type="button" data-act="expand">展开全部</button>' +
        '<button type="button" data-act="collapse">收起全部</button>' +
        '<button type="button" data-act="reset">重置勾选</button>' +
        "</span></h4>" +
        '<div class="exercise-list">' +
        day.exercises.map(function (ex, i) { return exerciseHtml(ex, i, day.id); }).join("") +
        "</div></div>";
    }

    if (day.cooldown) {
      html += blockHtml("训练后拉伸", "约 6 分钟", plainList(day.cooldown));
    }

    if (day.sessions) {
      day.sessions.forEach(function (session) {
        html += blockHtml(session.title, session.time, plainList(session.items));
      });
    }

    if (day.note) {
      html += '<p class="tip" style="margin-top:28px"><b>说明</b>' + esc(day.note) + "</p>";
    }

    $("#dayPanel").innerHTML = html;
    renderDayGrid();
    updateDayProgress();
    syncAppBar();
  }

  function updateDayProgress() {
    var day = activeDay;
    if (day.exercises) {
      var done = doneCount(day);
      var fill = $("#dayFill");
      var text = $("#dayText");
      if (fill) { fill.style.width = (done / day.exercises.length) * 100 + "%"; }
      if (text) {
        text.textContent = done === day.exercises.length
          ? "今天全部完成 🎉"
          : "已完成 " + done + " / " + day.exercises.length;
      }
    }
    renderDayGrid();
    renderCheckin();
  }

  /* ---------- 打卡面板 ---------- */

  function renderCheckin() {
    var countEl = $("#checkinCount");
    if (!countEl) { return; }

    var today = keyOfToday();
    var on = isChecked(today);

    countEl.textContent = String(checkinTotal());
    $("#checkinStreak").textContent = "连续 " + checkinStreak() + " 天";
    $("#checkinWeek").textContent = checkinWeekCount() + " / " + trainingDays();

    var todayDay = dayForSlot(todaySlot());
    var total = todayDay && todayDay.exercises ? todayDay.exercises.length : 0;
    var done = total ? doneCount(todayDay) : 0;
    $("#checkinToday").textContent = total ? done + " / " + total : "休息日";

    var html = "";
    for (var i = 13; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = dateKey(d);
      var cls = "cin-cell";
      if (isChecked(key)) { cls += " is-on"; }
      if (key === today) { cls += " is-today"; }
      html += '<span class="' + cls + '" title="' + key + '">' + d.getDate() + "</span>";
    }
    $("#checkinGrid").innerHTML = html;

    var btn = $("#checkinBtn");
    btn.classList.toggle("is-on", on);
    btn.textContent = on ? "今日已打卡 ✓" : "今日打卡";

    $("#checkinHint").textContent = on
      ? "已记录 " + today + "，明天继续。"
      : (total && done < total
        ? "今天还有 " + (total - done) + " 个动作没勾完，练完再点更准。"
        : "练完点一下，记录保存在这台设备的浏览器里。");

    var trackBtn = $('#tabbar .tab-item[data-tab="track"]');
    if (trackBtn) { trackBtn.classList.toggle("has-dot", !on && total > 0); }
  }

  $("#checkinBtn").addEventListener("click", function () {
    var key = keyOfToday();
    if (isChecked(key)) {
      setChecked(key, false);
      renderCheckin();
      return;
    }
    var todayDay = dayForSlot(todaySlot());
    if (todayDay && todayDay.exercises) {
      var total = todayDay.exercises.length;
      var done = doneCount(todayDay);
      if (done < total && !window.confirm("今天还有 " + (total - done) + " 个动作没勾完，仍然打卡吗？")) {
        return;
      }
    }
    setChecked(key, true);
    renderCheckin();
  });

  $("#tabbar").addEventListener("click", function (event) {
    var btn = event.target.closest("[data-tab]");
    if (btn) { switchTab(btn.getAttribute("data-tab")); }
  });

  $("#dayGrid").addEventListener("click", function (event) {
    var cell = event.target.closest("[data-slot]");
    if (cell) { renderDay(Number(cell.getAttribute("data-slot"))); }
  });

  window.addEventListener("hashchange", function () {
    var id = tabFromHash();
    if (id !== activeTab) { switchTab(id); }
  });

  /* ---------- 静态内容 ---------- */

  function routineHtml(items) {
    return items.map(function (item) {
      return '<div class="routine-item"><div><b>' + esc(item.name) + "</b><br><span>" + esc(item.time) +
        "</span></div><p>" + esc(item.detail) + "</p></div>";
    }).join("");
  }

  $("#warmupRoutine").innerHTML = routineHtml(WARMUP_ROUTINE);
  $("#stretchRoutine").innerHTML = routineHtml(STRETCH_ROUTINE);

  $("#rulesList").innerHTML = RULES.map(function (rule) {
    return '<article class="rule"><h3>' + esc(rule.title) + "</h3><p>" + esc(rule.body) + "</p></article>";
  }).join("");

  var quote = QUOTES[localDayIndex(QUOTES.length)];
  $("#quote").innerHTML = '<p class="quote-en">' + esc(quote.en) + "</p>" +
    '<p class="quote-zh">' + esc(quote.zh) + "</p>";

  /* ---------- 图片放大 ---------- */

  function syncScrollLock() {
    var locked = !$("#prefsSheet").hidden || !$("#lightbox").hidden || !$("#picker").hidden;
    document.body.classList.toggle("sheet-open", locked);
  }

  function openLightbox(src, caption) {
    if (!src) { return; }
    var box = $("#lightbox");
    var img = $("#lightboxImg");
    img.setAttribute("src", src);
    img.setAttribute("alt", caption || "");
    $("#lightboxCap").textContent = caption || "";
    box.hidden = false;
    syncScrollLock();
  }

  function closeLightbox() {
    var box = $("#lightbox");
    if (!box || box.hidden) { return; }
    box.hidden = true;
    $("#lightboxImg").removeAttribute("src");
    syncScrollLock();
  }

  $("#lightbox").addEventListener("click", closeLightbox);

  /* ---------- 个人喜好 ---------- */

  function renderThemeRow() {
    $("#themeRow").innerHTML = THEMES.map(function (theme) {
      return '<button type="button" class="theme-chip" data-theme-id="' + theme.id + '">' +
        '<span class="theme-dot" style="background:' + theme.dot + '"></span>' +
        "<span>" + esc(theme.name) + "</span></button>";
    }).join("");
    applyTheme(themeId, false);
  }

  function renderSchedList() {
    $("#schedList").innerHTML = SLOT_LABELS.map(function (label, slot) {
      var part = dayForSlot(slot).part;
      return '<button type="button" class="sched-cell" data-slot="' + slot + '" aria-haspopup="listbox"' +
        ' aria-label="' + esc(label) + "练什么：" + esc(part) + '">' +
        '<span class="sched-cell-top"><b>' + esc(label) + "</b>" +
          '<span class="drag-handle" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/>' +
            '<circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>' +
          "</span></span>" +
        '<span class="sched-cell-part">' + esc(part) + "</span>" +
        "</button>";
    }).join("");
    $("#schedNote").textContent = "每周 " + splitText();
  }

  function swapSlots(a, b) {
    if (a === b) { return; }
    var tmp = schedule[a];
    schedule[a] = schedule[b];
    schedule[b] = tmp;
    saveSchedule();
    renderSchedList();
    renderHeroStats();
    renderDay(activeSlot);
  }

  /* 拖动换顺序：鼠标和触屏都走 pointer 事件，从格子右侧的小点起拖 */
  var dragState = null;
  var lastDragAt = 0;

  function cellAtPoint(x, y, notThis) {
    var el = document.elementFromPoint(x, y);
    var cell = el && el.closest ? el.closest(".sched-cell") : null;
    return cell && cell !== notThis ? cell : null;
  }

  $("#schedList").addEventListener("pointerdown", function (event) {
    var handle = event.target.closest(".drag-handle");
    if (!handle) { return; }
    var cell = handle.closest(".sched-cell");
    if (!cell) { return; }
    event.preventDefault();
    dragState = { cell: cell, target: null };
    cell.classList.add("is-dragging");
    try { handle.setPointerCapture(event.pointerId); } catch (err) { /* 忽略 */ }
  });

  $("#schedList").addEventListener("pointermove", function (event) {
    if (!dragState) { return; }
    event.preventDefault();
    var over = cellAtPoint(event.clientX, event.clientY, dragState.cell);
    if (dragState.target && dragState.target !== over) { dragState.target.classList.remove("is-over"); }
    dragState.target = over;
    if (over) { over.classList.add("is-over"); }
  });

  function endDrag() {
    if (!dragState) { return; }
    var state = dragState;
    dragState = null;
    lastDragAt = Date.now();
    state.cell.classList.remove("is-dragging");
    if (state.target) { state.target.classList.remove("is-over"); }
    if (!state.target) { return; }
    swapSlots(Number(state.cell.getAttribute("data-slot")), Number(state.target.getAttribute("data-slot")));
  }

  $("#schedList").addEventListener("pointerup", endDrag);
  $("#schedList").addEventListener("pointercancel", endDrag);

  var pickerSlot = null;

  function openPicker(slot) {
    pickerSlot = slot;
    $("#pickerTitle").textContent = SLOT_LABELS[slot] + " 练什么";
    $("#pickerList").innerHTML = PLAN.map(function (day) {
      var on = day.id === schedule[slot];
      return '<button type="button" class="picker-item' + (on ? " is-on" : "") + '" role="option" aria-selected="' +
        (on ? "true" : "false") + '" data-day="' + day.id + '">' +
        "<span>" + esc(day.part) + "</span>" +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>' +
        "</button>";
    }).join("");
    $("#picker").hidden = false;
    syncScrollLock();
  }

  function closePicker() {
    pickerSlot = null;
    $("#picker").hidden = true;
    syncScrollLock();
  }

  function choosePart(dayId) {
    if (pickerSlot === null) { return; }
    schedule[pickerSlot] = dayId;
    saveSchedule();
    renderSchedList();
    renderHeroStats();
    renderDay(activeSlot);
    closePicker();
  }

  function openPrefs() {
    renderThemeRow();
    renderSchedList();
    renderOffline();
    $("#prefsSheet").hidden = false;
    syncScrollLock();
    $("#prefsSheet").scrollTop = 0;
  }

  function closePrefs() {
    if (!$("#picker").hidden) { closePicker(); }
    $("#prefsSheet").hidden = true;
    syncScrollLock();
  }

  $("#brandPrefs").addEventListener("click", openPrefs);
  $("#prefsBack").addEventListener("click", closePrefs);

  $("#themeRow").addEventListener("click", function (event) {
    var chip = event.target.closest("[data-theme-id]");
    if (chip) { applyTheme(chip.getAttribute("data-theme-id"), true); }
  });

  $("#schedList").addEventListener("click", function (event) {
    if (event.target.closest(".drag-handle")) { return; }
    if (Date.now() - lastDragAt < 350) { return; }
    var cell = event.target.closest("[data-slot]");
    if (cell) { openPicker(Number(cell.getAttribute("data-slot"))); }
  });

  $("#pickerList").addEventListener("click", function (event) {
    var item = event.target.closest("[data-day]");
    if (item) { choosePart(item.getAttribute("data-day")); }
  });

  $("#pickerBackdrop").addEventListener("click", closePicker);
  $("#pickerCancel").addEventListener("click", closePicker);

  $("#schedReset").addEventListener("click", function () {
    schedule = DEFAULT_SCHEDULE.slice();
    saveSchedule();
    renderSchedList();
    renderHeroStats();
    renderDay(activeSlot);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (!$("#lightbox").hidden) { closeLightbox(); return; }
      if (!$("#picker").hidden) { closePicker(); return; }
      if (!$("#prefsSheet").hidden) { closePrefs(); return; }
    }
    if (event.code === "Space" &&
        !/^(INPUT|TEXTAREA|BUTTON|SELECT)$/.test(document.activeElement.tagName) &&
        $("#prefsSheet").hidden && $("#lightbox").hidden && $("#picker").hidden) {
      event.preventDefault();
      if (timer.running) { pauseTimer(); } else { startTimer(); }
    }
  });

  /* ---------- 相册：照片压缩后存在本机 IndexedDB，不上传 ---------- */

  var PHOTO_DB = "fitness-plan.photos";
  var PHOTO_STORE = "photos";
  var photoUrls = [];

  function photoDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("no-indexeddb")); return; }
      var req = indexedDB.open(PHOTO_DB, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          db.createObjectStore(PHOTO_STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open-failed")); };
      req.onblocked = function () { reject(new Error("idb-blocked")); };
    });
  }

  function photoStore(mode, fn) {
    return photoDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(PHOTO_STORE, mode);
        var request = fn(tx.objectStore(PHOTO_STORE));
        tx.oncomplete = function () { resolve(request ? request.result : undefined); };
        tx.onerror = function () { reject(tx.error || new Error("idb-failed")); };
        tx.onabort = function () { reject(tx.error || new Error("idb-aborted")); };
      });
    });
  }

  function decodePhotoFallback(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.__url = url;
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("bad-image")); };
      img.src = url;
    });
  }

  function decodePhoto(file) {
    if (window.createImageBitmap) {
      try {
        return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
          return decodePhotoFallback(file);
        });
      } catch (err) { /* 落到下面的兜底 */ }
    }
    return decodePhotoFallback(file);
  }

  function shrinkPhoto(file) {
    return decodePhoto(file).then(function (source) {
      var w = source.width || source.naturalWidth;
      var h = source.height || source.naturalHeight;
      var scale = Math.min(1, 1600 / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext("2d").drawImage(source, 0, 0, cw, ch);
      if (source.__url) { URL.revokeObjectURL(source.__url); }
      if (source.close) { source.close(); }
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) { resolve({ blob: blob, w: cw, h: ch }); }, "image/jpeg", 0.82);
      });
    });
  }

  function addPhoto(record) { return photoStore("readwrite", function (s) { return s.add(record); }); }
  function listPhotos() { return photoStore("readonly", function (s) { return s.getAll(); }); }
  function removePhoto(id) { return photoStore("readwrite", function (s) { return s.delete(id); }); }
  function clearPhotoStore() { return photoStore("readwrite", function (s) { return s.clear(); }); }

  function renderAlbum() {
    var grid = $("#albumGrid");
    if (!grid) { return; }
    photoUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    photoUrls = [];

    listPhotos().then(function (items) {
      items.sort(function (a, b) { return b.ts - a.ts; });
      if (!items.length) {
        grid.innerHTML = '<p class="album-empty">还没有照片。第一次可以拍个全身，记下开始的样子。</p>';
      } else {
        grid.innerHTML = items.map(function (item) {
          var url = URL.createObjectURL(item.blob);
          photoUrls.push(url);
          return '<figure class="album-item" data-photo="' + item.id + '" data-date="' + esc(item.date) + '">' +
            '<img src="' + url + '" alt="' + esc(item.date) + ' 的训练记录" loading="lazy">' +
            '<figcaption>' + esc(item.date.slice(5).replace("-", " / ")) + "</figcaption>" +
            '<button type="button" class="album-del" data-del="' + item.id + '" aria-label="删除这张照片">×</button>' +
          "</figure>";
        }).join("");
      }
      var bytes = items.reduce(function (sum, item) { return sum + (item.blob ? item.blob.size : 0); }, 0);
      var sizeText = bytes < 1048576
        ? Math.max(1, Math.round(bytes / 1024)) + " KB"
        : (bytes / 1048576).toFixed(1) + " MB";
      $("#albumMeta").textContent = items.length ? items.length + " 张 · " + sizeText : "";
      $("#albumClear").hidden = !items.length;
    }).catch(function () {
      grid.innerHTML = '<p class="album-empty">这台设备的浏览器不允许网页存照片（用 file:// 双击打开时会被禁止）。用浏览器访问网址打开就能存。</p>';
      $("#albumMeta").textContent = "";
      $("#albumClear").hidden = true;
    });
  }

  function savePhotos(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (file) {
      return /^image\//.test(file.type);
    });
    if (!files.length) { return; }

    var chain = Promise.resolve();
    var saved = 0;
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        return shrinkPhoto(file).then(function (out) {
          if (!out.blob) { throw new Error("no-blob"); }
          return addPhoto({ date: dateKey(new Date()), ts: Date.now() + i, blob: out.blob, w: out.w, h: out.h });
        }).then(function () { saved++; });
      });
    });

    chain.then(function () {
      renderAlbum();
      var note = "已保存 " + saved + " 张到本机，没有上传。";
      if (!isChecked(keyOfToday())) {
        setChecked(keyOfToday(), true);
        renderCheckin();
        note += "同时帮你打了今天的卡。";
      }
      $("#albumHint").textContent = note;
    }).catch(function () {
      $("#albumHint").textContent = "这张没存上，换一张再试试。";
    });
  }

  $("#albumShoot").addEventListener("click", function () { $("#photoCamera").click(); });
  $("#albumPick").addEventListener("click", function () { $("#photoPick").click(); });

  $("#photoCamera").addEventListener("change", function (event) {
    savePhotos(event.target.files);
    event.target.value = "";
  });

  $("#photoPick").addEventListener("change", function (event) {
    savePhotos(event.target.files);
    event.target.value = "";
  });

  $("#albumGrid").addEventListener("click", function (event) {
    var del = event.target.closest("[data-del]");
    if (del) {
      var id = Number(del.getAttribute("data-del"));
      if (window.confirm("删掉这张照片？")) {
        removePhoto(id).then(renderAlbum, function () {
          $("#albumHint").textContent = "删除失败，稍后再试。";
        });
      }
      return;
    }
    var item = event.target.closest(".album-item");
    if (item) {
      var img = $("img", item);
      openLightbox(img.getAttribute("src"), item.getAttribute("data-date") + " 的训练记录");
    }
  });

  $("#albumClear").addEventListener("click", function () {
    if (window.confirm("清空整个相册？删掉就找不回来了。")) {
      clearPhotoStore().then(renderAlbum, function () {
        $("#albumHint").textContent = "清空失败，稍后再试。";
      });
    }
  });

  /* ---------- 离线 ---------- */

  function isLocalDevHost() {
    if (!/^https?:$/.test(location.protocol)) { return true; }
    return location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "::1";
  }

  function renderOffline() {
    var el = $("#offlineNote");
    if (!el) { return; }
    if (!/^https?:$/.test(location.protocol)) {
      el.textContent = "用网址打开时会自动缓存到本机，断网也能看。";
      return;
    }
    if (isLocalDevHost()) {
      el.textContent = "本地调试（localhost）不启用离线缓存，免得改完文件看不到新版；发布到线上后会自动开启。";
      return;
    }
    if (!("serviceWorker" in navigator)) {
      el.textContent = "这个浏览器不支持离线缓存，联网打开即可。";
      return;
    }
    el.textContent = navigator.onLine
      ? "已缓存到本机，断网也能打开。"
      : "当前离线，正在用本机缓存。";
  }

  window.addEventListener("online", renderOffline);
  window.addEventListener("offline", renderOffline);

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    if (isLocalDevHost()) {
      /* 本地调试：把之前注册过的缓存清掉，避免刷新后还是旧文件 */
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister(); });
      }).catch(function () { /* 忽略 */ });
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (key) { caches.delete(key); });
        }).catch(function () { /* 忽略 */ });
      }
    } else {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").then(function () {
          renderOffline();
        }, function () {
          var el = $("#offlineNote");
          if (el && !$("#prefsSheet").hidden) { el.textContent = "离线缓存没注册成功，联网打开即可。"; }
        });
      });
    }
  }

  /* ---------- 组间休息计时器 ---------- */

  var timer = { total: 90, left: 90, running: false, tick: null, endAt: 0 };
  var clockEl = $("#timerClock");
  var fillEl = $("#timerFill");
  var toggleEl = $("#timerToggle");
  var restBarEl = $("#restBar");

  function paintRestBar() {
    if (!restBarEl) { return; }
    var show = timer.running && activeTab !== "track" && $("#prefsSheet").hidden;
    restBarEl.hidden = !show;
    document.body.classList.toggle("has-rest", show);
    if (!show) { return; }
    var barClock = $("#restBarClock");
    if (barClock && barClock.textContent !== clockEl.textContent) {
      barClock.textContent = clockEl.textContent;
    }
  }

  function paintTimer() {
    clockEl.textContent = pad(Math.floor(timer.left / 60)) + ":" + pad(timer.left % 60);
    fillEl.style.width = (timer.total ? (timer.left / timer.total) * 100 : 0) + "%";
    toggleEl.textContent = timer.running ? "暂停" : (timer.left === 0 ? "再来一组" : "开始");
    if (timer.running) {
      document.title = clockEl.textContent + " · 组间休息";
    } else {
      document.title = timer.left === 0 ? "休息结束 · " + BASE_TITLE : BASE_TITLE;
    }
    paintRestBar();
  }

  function stopTicking() {
    if (timer.tick) { clearInterval(timer.tick); timer.tick = null; }
  }

  function startTimer() {
    if (timer.running) { return; }
    if (timer.left <= 0) { timer.left = timer.total; }
    timer.running = true;
    timer.endAt = Date.now() + timer.left * 1000;
    timer.tick = setInterval(function () {
      timer.left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
      paintTimer();
      if (timer.left === 0) {
        stopTicking();
        timer.running = false;
        paintTimer();
        beep(3);
        if (navigator.vibrate) { navigator.vibrate([120, 80, 120]); }
      }
    }, 250);
    paintTimer();
  }

  function pauseTimer() {
    stopTicking();
    timer.running = false;
    paintTimer();
  }

  function setTimer(seconds, autoStart) {
    stopTicking();
    timer.running = false;
    timer.total = seconds;
    timer.left = seconds;
    $$("#timerPresets button").forEach(function (btn) {
      btn.classList.toggle("is-active", Number(btn.getAttribute("data-sec")) === seconds);
    });
    paintTimer();
    if (autoStart) { startTimer(); }
  }

  function beep(times) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { return; }
      window.__beepCtx = window.__beepCtx || new Ctx();
      var ctx = window.__beepCtx;
      if (ctx.state === "suspended") { ctx.resume(); }
      for (var i = 0; i < times; i++) {
        var at = ctx.currentTime + i * 0.24;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.2);
      }
    } catch (err) { /* 静音失败不影响使用 */ }
  }

  toggleEl.addEventListener("click", function () {
    if (timer.running) { pauseTimer(); } else { startTimer(); }
  });

  $("#timerReset").addEventListener("click", function () { setTimer(timer.total, false); });

  $("#timerPresets").addEventListener("click", function (event) {
    var btn = event.target.closest("button[data-sec]");
    if (btn) { setTimer(Number(btn.getAttribute("data-sec")), false); }
  });

  $("#restBarToggle").addEventListener("click", function () {
    if (timer.running) { pauseTimer(); } else { startTimer(); }
  });

  $("#restBarJump").addEventListener("click", function () { switchTab("track"); });

  /* ---------- 动作列表交互 ---------- */

  function bindPanelOnce() {
    var panel = $("#dayPanel");

    panel.addEventListener("click", function (event) {
      var zoom = event.target.closest(".ex-thumb") || event.target.closest(".ex-figure img");
      if (zoom) {
        var card = zoom.closest(".exercise");
        var nameEl = card ? $(".ex-name", card) : null;
        openLightbox(zoom.getAttribute("src"), nameEl ? nameEl.textContent + " · 起始位与顶峰位" : "");
        return;
      }

      var toolbarBtn = event.target.closest("[data-act]");

      if (toolbarBtn && toolbarBtn.closest(".toolbar")) {
        var act = toolbarBtn.getAttribute("data-act");
        if (act === "expand" || act === "collapse") {
          expandAll = act === "expand";
          $$(".exercise", panel).forEach(function (card) {
            card.classList.toggle("is-open", expandAll);
            $(".ex-head", card).setAttribute("aria-expanded", String(expandAll));
          });
        } else if (act === "reset") {
          if (window.confirm("清空这一天的完成勾选？")) {
            progress[activeDay.id] = {};
            saveProgress();
            $$(".exercise", panel).forEach(function (card) {
              card.classList.remove("is-done");
              $(".check", card).lastChild.textContent = "标记完成";
            });
            updateDayProgress();
          }
        }
        return;
      }

      var head = event.target.closest(".ex-head");
      if (head) {
        var cardEl = head.closest(".exercise");
        var open = cardEl.classList.toggle("is-open");
        head.setAttribute("aria-expanded", String(open));
        return;
      }

      var actionBtn = event.target.closest("[data-act]");
      if (!actionBtn) { return; }
      var exCard = actionBtn.closest(".exercise");
      if (!exCard) { return; }
      var index = Number(exCard.getAttribute("data-index"));

      if (actionBtn.getAttribute("data-act") === "done") {
        var next = !isDone(activeDay.id, index);
        setDone(activeDay.id, index, next);
        exCard.classList.toggle("is-done", next);
        actionBtn.lastChild.textContent = next ? "已完成" : "标记完成";
        updateDayProgress();
      } else if (actionBtn.getAttribute("data-act") === "rest") {
        setTimer(Number(actionBtn.getAttribute("data-sec")) || 90, true);
      }
    });
  }

  /* ---------- 启动 ---------- */

  applyTheme(loadTheme(), false);
  renderHeroStats();
  bindPanelOnce();
  renderDay(activeSlot);
  setTimer(90, false);
  switchTab(tabFromHash(), true);
  renderCheckin();
  renderAlbum();
  renderOffline();
})();
