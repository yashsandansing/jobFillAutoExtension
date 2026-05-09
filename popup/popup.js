document.addEventListener("DOMContentLoaded", async () => {
  const configStorageKey = "jobFillConfig";
  const root = document.getElementById("popup");

  const storageData = await getStorage([configStorageKey]);
  const config = readConfig(storageData, configStorageKey);
  const rawFields = Array.isArray(config.fields) ? config.fields : [];
  const fields = rawFields.map(normalizeField);
  const tab = await getActiveTab();
  const detectedValues = await getDetectedValues(tab);
  const valuesByFieldId = {};

  fields.forEach((field) => {
    valuesByFieldId[field.id] = getAutofillValue(field, tab, detectedValues);
  });

  const isSetup = !config.sheetId || !config.tabName || fields.length === 0;

  renderHead(root);

  if (isSetup) {
    renderSetupState(root, config);
    return;
  }

  const hasAnyAutoValue = fields.some((f) => {
    if (!f.autoExtract) return false;
    const sourceVal = getSourceAutoValue(f, tab, detectedValues);
    return sourceVal && valuesByFieldId[f.id] === sourceVal;
  });
  const detectedOrg = detectedValues.organization || "";

  if (hasAnyAutoValue && detectedOrg) {
    renderSourceBadge(root, detectedOrg);
  }

  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);

  renderFormBody(root, requiredFields, optionalFields, valuesByFieldId, tab, detectedValues);
  renderFoot(root, config, fields, valuesByFieldId);
});

function renderHead(root) {
  const head = document.createElement("div");
  head.className = "popup-head";

  const mark = document.createElement("div");
  mark.className = "popup-mark";
  mark.textContent = "JF";

  const title = document.createElement("span");
  title.className = "popup-title";
  title.textContent = "Job Fill";

  const gear = document.createElement("button");
  gear.className = "popup-gear";
  gear.title = "Settings";
  gear.innerHTML = "&#9881;";
  gear.addEventListener("click", () => chrome.runtime.openOptionsPage());

  head.append(mark, title, gear);
  root.appendChild(head);
}

function renderSourceBadge(root, org) {
  const src = document.createElement("div");
  src.className = "popup-source";
  src.innerHTML = `✦ Auto-detected on <strong style="margin-left:3px">${escapeHtml(org)}</strong>`;
  root.appendChild(src);
}

function renderFormBody(root, requiredFields, optionalFields, valuesByFieldId, tab, detectedValues) {
  const body = document.createElement("div");
  body.className = "popup-body";
  requiredFields.forEach((field) => {
    body.appendChild(createFieldGroup(field, valuesByFieldId, tab, detectedValues));
  });
  root.appendChild(body);

  if (!optionalFields.length) return;

  const moreWrap = document.createElement("div");
  moreWrap.className = "popup-more-wrap";

  const divider = document.createElement("div");
  divider.className = "popup-divider";

  const moreBtn = document.createElement("button");
  moreBtn.className = "popup-more-btn";
  const count = optionalFields.length;
  moreBtn.textContent = `Show ${count} optional field${count > 1 ? "s" : ""}`;

  const optBody = document.createElement("div");
  optBody.className = "popup-body";
  optBody.style.display = "none";
  optBody.style.paddingTop = "4px";
  optionalFields.forEach((field) => {
    optBody.appendChild(createFieldGroup(field, valuesByFieldId, tab, detectedValues));
  });

  let expanded = false;
  moreBtn.addEventListener("click", () => {
    expanded = !expanded;
    optBody.style.display = expanded ? "block" : "none";
    moreBtn.textContent = expanded
      ? "Hide optional fields"
      : `Show ${count} optional field${count > 1 ? "s" : ""}`;
  });

  moreWrap.append(divider, moreBtn);
  root.append(moreWrap, optBody);
}

function createFieldGroup(field, valuesByFieldId, tab, detectedValues) {
  const group = document.createElement("div");
  group.className = "field-group";

  const labelRow = document.createElement("div");
  labelRow.className = "field-label-row";

  const labelText = document.createElement("span");
  labelText.className = "field-label-text";
  labelText.textContent = field.name + (field.required ? " *" : "");
  labelRow.appendChild(labelText);

  const val = valuesByFieldId[field.id];
  const sourceVal = getSourceAutoValue(field, tab, detectedValues);
  const isAuto = field.autoExtract && val && val === sourceVal;
  const isPreset = !isAuto && field.staticValue && val === field.staticValue;

  if (isAuto) {
    const badge = document.createElement("span");
    badge.className = "badge badge-auto";
    badge.textContent = "auto";
    labelRow.appendChild(badge);
  } else if (isPreset) {
    const badge = document.createElement("span");
    badge.className = "badge badge-preset";
    badge.textContent = "preset";
    labelRow.appendChild(badge);
  }

  let input;
  if (field.type === "textarea") {
    input = document.createElement("textarea");
    input.value = val || "";
  } else if (field.type === "select" && field.options && field.options.length) {
    input = document.createElement("select");
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = field.placeholder || "Select…";
    input.appendChild(blank);
    field.options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === val) o.selected = true;
      input.appendChild(o);
    });
  } else {
    input = document.createElement("input");
    if (field.type === "number") input.type = "number";
    else if (field.type === "date" && field.autoExtract !== "dateApplied") input.type = "date";
    else if (field.type === "url") input.type = "url";
    else input.type = "text";
    input.value = val || "";
  }

  input.className = "field-input" + (isAuto ? " has-auto" : "");
  if (field.placeholder && input.tagName !== "SELECT") input.placeholder = field.placeholder;

  input.addEventListener("input", () => {
    valuesByFieldId[field.id] = input.value;
    if (input.classList.contains("has-auto")) {
      input.classList.remove("has-auto");
    }
  });

  group.append(labelRow, input);
  return group;
}

function renderFoot(root, config, fields, valuesByFieldId) {
  const errorEl = document.createElement("div");
  errorEl.className = "popup-error";

  const foot = document.createElement("div");
  foot.className = "popup-foot";

  const submitBtn = document.createElement("button");
  submitBtn.className = "popup-submit";
  submitBtn.innerHTML = `Add to sheet <span class="shortcut-hint">&#8629;</span>`;

  foot.appendChild(submitBtn);
  root.append(errorEl, foot);

  submitBtn.addEventListener("click", handleSubmit);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.target === document.body || e.target.tagName !== "TEXTAREA") && !submitBtn.disabled) {
      handleSubmit();
    }
  });

  function handleSubmit() {
    const missingRequired = fields.filter(
      (f) => f.required && !String(valuesByFieldId[f.id] || "").trim(),
    );

    if (missingRequired.length) {
      errorEl.textContent = `Required: ${missingRequired.map((f) => f.name).join(", ")}`;
      errorEl.style.display = "block";
      return;
    }

    errorEl.style.display = "none";
    submitBtn.disabled = true;
    submitBtn.innerHTML = "Saving…";

    chrome.runtime.sendMessage(
      {
        action: "appendToSheet",
        payload: {
          sheetId: config.sheetId,
          tabName: config.tabName,
          valuesByFieldId,
          fields,
        },
      },
      (response) => {
        submitBtn.disabled = false;
        if (response && response.success) {
          renderSuccessState(root, fields, valuesByFieldId, config);
        } else {
          submitBtn.innerHTML = `Add to sheet <span class="shortcut-hint">&#8629;</span>`;
          const msg = response ? response.error : "Unknown error";
          errorEl.textContent = `Error: ${msg}`;
          errorEl.style.display = "block";
        }
      },
    );
  }
}

function renderSuccessState(root, fields, valuesByFieldId, config) {
  root.innerHTML = "";
  renderHead(root);

  const success = document.createElement("div");
  success.className = "success-state";

  const iconEl = document.createElement("div");
  iconEl.className = "success-icon";
  iconEl.textContent = "✓";

  const titleEl = document.createElement("div");
  titleEl.className = "success-title";
  titleEl.textContent = "Added to sheet";

  const subEl = document.createElement("div");
  subEl.className = "success-sub";
  subEl.textContent = "Row appended successfully";

  const summary = fields.filter((f) => f.required).slice(0, 3);
  let previewEl = null;
  if (summary.length) {
    previewEl = document.createElement("div");
    previewEl.className = "success-preview";
    summary.forEach((f) => {
      const item = document.createElement("div");
      item.className = "success-row-item";
      item.innerHTML = `<span class="success-row-key">${escapeHtml(f.name)}</span><span>${escapeHtml(valuesByFieldId[f.id] || "—")}</span>`;
      previewEl.appendChild(item);
    });
  }

  const actions = document.createElement("div");
  actions.className = "success-actions";

  const againBtn = document.createElement("button");
  againBtn.className = "success-again";
  againBtn.textContent = "Log another";
  againBtn.addEventListener("click", () => window.location.reload());

  const sheetBtn = document.createElement("button");
  sheetBtn.className = "success-sheet";
  sheetBtn.textContent = "Open sheet";
  sheetBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: `https://docs.google.com/spreadsheets/d/${config.sheetId}/edit` });
  });

  actions.append(againBtn, sheetBtn);
  success.append(iconEl, titleEl, subEl);
  if (previewEl) success.appendChild(previewEl);
  success.appendChild(actions);
  root.appendChild(success);
}

function renderSetupState(root, config) {
  const setup = document.createElement("div");
  setup.className = "setup-state";

  const titleEl = document.createElement("div");
  titleEl.className = "setup-title";
  titleEl.textContent = "Finish setup to get started";

  const items = [
    { label: "Set Google Sheet ID", done: Boolean(config.sheetId) },
    { label: "Set tab name", done: Boolean(config.tabName) },
    { label: "Add at least one field", done: Array.isArray(config.fields) && config.fields.length > 0 },
  ];

  const list = document.createElement("ul");
  list.className = "setup-checklist";
  items.forEach((item) => {
    const li = document.createElement("li");
    const icon = document.createElement("span");
    icon.className = "check-icon " + (item.done ? "done" : "todo");
    icon.textContent = item.done ? "✓" : "·";
    const text = document.createElement("span");
    text.textContent = item.label;
    if (item.done) text.style.cssText = "color: var(--ink-3); text-decoration: line-through";
    li.append(icon, text);
    list.appendChild(li);
  });

  const btn = document.createElement("button");
  btn.className = "setup-open-btn";
  btn.textContent = "Open Settings";
  btn.addEventListener("click", () => chrome.runtime.openOptionsPage());

  setup.append(titleEl, list, btn);
  root.appendChild(setup);
}

// ── Storage helpers ──────────────────────────────────────────────────────────

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function readConfig(data, configStorageKey) {
  const storedConfig = data[configStorageKey] || {};
  return {
    sheetId: storedConfig.sheetId || "",
    tabName: storedConfig.tabName || "",
    fields: Array.isArray(storedConfig.fields) ? storedConfig.fields : [],
  };
}

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

function getDetectedValues(tab) {
  return new Promise((resolve) => {
    if (!tab?.id) { resolve({}); return; }
    chrome.tabs.sendMessage(tab.id, { action: "extractData" }, (response) => {
      if (chrome.runtime.lastError) { resolve({}); return; }
      resolve(response || {});
    });
  });
}

// ── Autofill logic ───────────────────────────────────────────────────────────

function getSourceAutoValue(field, tab, detectedValues) {
  switch (field.autoExtract) {
    case "jobTitle":    return detectedValues.role || "";
    case "company":     return detectedValues.organization || "";
    case "location":    return detectedValues.location || "";
    case "salary":      return detectedValues.salary || "";
    case "url":         return tab?.url || "";
    case "dateApplied": return formatTodayWithOptions(field.dateFormat, field.dateSeparator);
    default:            return "";
  }
}

function getAutofillValue(field, tab, detectedValues) {
  const source = getSourceAutoValue(field, tab, detectedValues);
  if (source.trim()) return source;
  return field.staticValue || "";
}

function normalizeField(field) {
  let autoExtract = field.autoExtract || "";
  if (!autoExtract && field.autofillSource) {
    const map = {
      currentUrl: "url",
      role: "jobTitle",
      organization: "company",
      location: "location",
      salary: "salary",
      today: "dateApplied",
      manual: "",
    };
    autoExtract = map[field.autofillSource] || "";
  }

  let staticValue = field.staticValue || "";
  if (!staticValue && field.defaultValueEnabled && field.defaultValue) {
    staticValue = field.defaultValue;
  }

  return {
    id: typeof field.id === "string" ? field.id : "",
    name: typeof field.name === "string" ? field.name
      : (typeof field.label === "string" ? field.label : ""),
    type: field.type || "text",
    required: Boolean(field.required),
    autoExtract,
    staticValue,
    placeholder: field.placeholder || "",
    options: Array.isArray(field.options) ? field.options : [],
    dateFormat: field.dateFormat || "dd/mm/yyyy",
    dateSeparator: typeof field.dateSeparator === "string" ? field.dateSeparator : "/",
  };
}

function formatTodayWithOptions(pattern, separator) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  const yy = yyyy.slice(-2);
  const sep = (separator !== undefined && separator !== null) ? String(separator) : "/";
  return (pattern || "dd/mm/yyyy").split("/").map((p) => {
    if (p === "dd") return dd;
    if (p === "mm") return mm;
    if (p === "yyyy") return yyyy;
    if (p === "yy") return yy;
    return p;
  }).join(sep);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

if (typeof module !== "undefined") {
  module.exports = {
    getStorage,
    readConfig,
    getActiveTab,
    getDetectedValues,
    getAutofillValue,
    getSourceAutoValue,
    normalizeField,
    formatTodayWithOptions,
  };
}
