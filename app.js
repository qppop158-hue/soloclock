const storageKey = "solo-clock-settings";

const el = {
  todayLabel: document.querySelector("#todayLabel"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsForm: document.querySelector("#settingsForm"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  privateKey: document.querySelector("#privateKey"),
  clearSettingsButton: document.querySelector("#clearSettingsButton"),
  statusTitle: document.querySelector("#statusTitle"),
  statusSubtitle: document.querySelector("#statusSubtitle"),
  todayHours: document.querySelector("#todayHours"),
  clockInButton: document.querySelector("#clockInButton"),
  clockOutButton: document.querySelector("#clockOutButton"),
  editTodayButton: document.querySelector("#editTodayButton"),
  clockInTime: document.querySelector("#clockInTime"),
  clockOutTime: document.querySelector("#clockOutTime"),
  monthLabel: document.querySelector("#monthLabel"),
  monthHours: document.querySelector("#monthHours"),
  entryList: document.querySelector("#entryList"),
  editDialog: document.querySelector("#editDialog"),
  editForm: document.querySelector("#editForm"),
  editWorkDate: document.querySelector("#editWorkDate"),
  editClockIn: document.querySelector("#editClockIn"),
  editClockOut: document.querySelector("#editClockOut"),
  toast: document.querySelector("#toast"),
};

let settings = loadSettings();
let entries = [];

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings(nextSettings) {
  settings = nextSettings;
  localStorage.setItem(storageKey, JSON.stringify(settings));
}

function isConfigured() {
  return Boolean(settings.supabaseUrl && settings.supabaseAnonKey && settings.privateKey);
}

function todayDate() {
  return new Date().toLocaleDateString("en-CA");
}

function monthStartDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA");
}

function monthEndDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("en-CA");
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(`${value}T12:00:00`));
}

function hoursBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, (new Date(end) - new Date(start)) / 36e5);
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => el.toast.classList.remove("visible"), 2600);
}

function openDialog(dialog) {
  if (!dialog) {
    showToast("找不到修改視窗，請重新部署完整檔案");
    return false;
  }

  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  return true;
}

function closeDialog(dialog) {
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

async function rpc(functionName, body) {
  const baseUrl = settings.supabaseUrl.replace(/\/$/, "");
  const apiKey = settings.supabaseAnonKey.trim();
  const headers = {
    apikey: apiKey,
    "Content-Type": "application/json",
  };

  if (!apiKey.startsWith("sb_publishable_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Supabase request failed: ${response.status}`;

    try {
      const parsed = JSON.parse(text);
      message = parsed.message || parsed.msg || message;
    } catch {}

    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function refreshEntries() {
  if (!isConfigured()) {
    entries = [];
    render();
    openDialog(el.settingsDialog);
    return;
  }

  try {
    entries = await rpc("get_clock_month", {
      p_app_key: settings.privateKey,
      p_start_date: monthStartDate(),
      p_end_date: monthEndDate(),
    });
    render();
  } catch (error) {
    render();
    showToast(`無法讀取：${error.message}`);
    console.error(error);
  }
}

async function clock(action) {
  if (!isConfigured()) {
    openDialog(el.settingsDialog);
    return;
  }

  const button = action === "in" ? el.clockInButton : el.clockOutButton;
  button.disabled = true;

  try {
    await rpc(action === "in" ? "clock_in" : "clock_out", {
      p_app_key: settings.privateKey,
      p_work_date: todayDate(),
    });
    showToast(action === "in" ? "上班時間已記錄" : "下班時間已記錄");
    await refreshEntries();
  } catch (error) {
    showToast(`打卡失敗：${error.message}`);
    console.error(error);
  } finally {
    button.disabled = false;
  }
}

function openEditDialog(entry) {
  if (!isConfigured()) {
    openDialog(el.settingsDialog);
    return;
  }

  if (!el.editWorkDate || !el.editClockIn || !el.editClockOut) {
    showToast("修改表單未載入，請重新上傳 index.html");
    return;
  }

  const fallbackDate = todayDate();
  const workDate = entry?.work_date ?? fallbackDate;
  const now = new Date();
  const defaultClockIn = new Date(`${workDate}T09:00:00`);
  const defaultClockOut = new Date(`${workDate}T18:00:00`);

  el.editWorkDate.value = workDate;
  el.editClockIn.value = toDateTimeLocal(entry?.clock_in_at ?? defaultClockIn.toISOString());
  el.editClockOut.value = toDateTimeLocal(entry?.clock_out_at ?? (entry?.clock_in_at ? now.toISOString() : defaultClockOut.toISOString()));
  openDialog(el.editDialog);
}

async function saveEditedEntry() {
  if (!isConfigured()) {
    openDialog(el.settingsDialog);
    return;
  }

  const clockIn = fromDateTimeLocal(el.editClockIn.value);
  const clockOut = fromDateTimeLocal(el.editClockOut.value);

  if (clockOut && new Date(clockOut) < new Date(clockIn)) {
    showToast("下班時間不能早於上班時間");
    return;
  }

  try {
    await rpc("set_clock_entry", {
      p_app_key: settings.privateKey,
      p_work_date: el.editWorkDate.value,
      p_clock_in_at: clockIn,
      p_clock_out_at: clockOut,
    });
    closeDialog(el.editDialog);
    showToast("打卡時間已修改");
    await refreshEntries();
  } catch (error) {
    showToast(`修改失敗：${error.message}`);
    console.error(error);
  }
}

function render() {
  const now = new Date();
  el.todayLabel.textContent = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  el.monthLabel.textContent = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
  }).format(now);

  const today = entries.find((entry) => entry.work_date === todayDate());
  const todayHours = hoursBetween(today?.clock_in_at, today?.clock_out_at);
  const monthHours = entries.reduce(
    (sum, entry) => sum + hoursBetween(entry.clock_in_at, entry.clock_out_at),
    0,
  );

  el.todayHours.textContent = todayHours.toFixed(2);
  el.monthHours.textContent = `${monthHours.toFixed(2)} 小時`;
  el.clockInTime.textContent = formatTime(today?.clock_in_at);
  el.clockOutTime.textContent = formatTime(today?.clock_out_at);
  el.clockInButton.disabled = Boolean(today?.clock_in_at);
  el.clockOutButton.disabled = !today?.clock_in_at || Boolean(today?.clock_out_at);
  if (el.editTodayButton) {
    el.editTodayButton.disabled = !isConfigured();
  }

  if (!isConfigured()) {
    el.statusTitle.textContent = "尚未設定";
    el.statusSubtitle.textContent = "先填入 Supabase URL、anon key 和私人打卡 key。";
  } else if (!today?.clock_in_at) {
    el.statusTitle.textContent = "今天尚未上班";
    el.statusSubtitle.textContent = "按下上班後，雲端會記錄目前時間。";
  } else if (!today?.clock_out_at) {
    el.statusTitle.textContent = "工作中";
    el.statusSubtitle.textContent = `上班時間 ${formatTime(today.clock_in_at)}，下班時再按一下。`;
  } else {
    el.statusTitle.textContent = "今天已完成";
    el.statusSubtitle.textContent = `今日工時 ${todayHours.toFixed(2)} 小時。`;
  }

  renderEntryList();
}

function renderEntryList() {
  if (!entries.length) {
    el.entryList.innerHTML = '<p class="empty">還沒有打卡紀錄。</p>';
    return;
  }

  el.entryList.innerHTML = entries
    .slice()
    .sort((a, b) => b.work_date.localeCompare(a.work_date))
    .map((entry) => {
      const hours = hoursBetween(entry.clock_in_at, entry.clock_out_at);
      return `
        <article class="entry-row">
          <div class="entry-date">${formatDate(entry.work_date)}</div>
          <div class="entry-times">${formatTime(entry.clock_in_at)} - ${formatTime(entry.clock_out_at)}</div>
          <div class="entry-hours">${hours.toFixed(2)}h</div>
          <button class="entry-edit" type="button" data-edit-date="${entry.work_date}">修改</button>
        </article>
      `;
    })
    .join("");
}

function fillSettingsForm() {
  el.supabaseUrl.value = settings.supabaseUrl ?? "";
  el.supabaseAnonKey.value = settings.supabaseAnonKey ?? "";
  el.privateKey.value = settings.privateKey ?? "";
}

el.settingsButton.addEventListener("click", () => {
  fillSettingsForm();
  openDialog(el.settingsDialog);
});

el.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings({
    supabaseUrl: el.supabaseUrl.value.trim(),
    supabaseAnonKey: el.supabaseAnonKey.value.trim(),
    privateKey: el.privateKey.value.trim(),
  });
  closeDialog(el.settingsDialog);
  showToast("設定已儲存");
  refreshEntries();
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-dialog]");
  if (!closeButton) return;
  closeDialog(closeButton.closest("dialog"));
});

el.clearSettingsButton.addEventListener("click", () => {
  localStorage.removeItem(storageKey);
  settings = {};
  fillSettingsForm();
  render();
  showToast("設定已清除");
});

el.clockInButton.addEventListener("click", () => clock("in"));
el.clockOutButton.addEventListener("click", () => clock("out"));
el.editTodayButton?.addEventListener("click", () => {
  openEditDialog(entries.find((entry) => entry.work_date === todayDate()));
});

el.entryList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-date]");
  if (!button) return;
  openEditDialog(entries.find((entry) => entry.work_date === button.dataset.editDate));
});

el.editForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditedEntry();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

fillSettingsForm();
refreshEntries();
