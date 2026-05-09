const CONFIG_STORAGE_KEY = "jobFillConfig";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "url", label: "URL" },
  { value: "select", label: "Select (dropdown)" },
  { value: "textarea", label: "Textarea" },
];

const TYPE_ICONS = {
  text: "T",
  number: "#",
  date: "◷",
  url: "↗",
  select: "▾",
  textarea: "≡",
};

const AUTO_EXTRACT_OPTIONS = [
  { value: "", label: "None" },
  { value: "url", label: "Current URL" },
  { value: "jobTitle", label: "Detected job title" },
  { value: "company", label: "Detected company" },
  { value: "location", label: "Detected location" },
  { value: "salary", label: "Detected salary" },
  { value: "dateApplied", label: "Today's date" },
];

const DATE_FORMAT_OPTIONS = [
  { value: "dd/mm/yyyy", label: "dd/mm/yyyy" },
  { value: "mm/dd/yyyy", label: "mm/dd/yyyy" },
  { value: "yyyy/dd/mm", label: "yyyy/dd/mm" },
  { value: "yyyy/mm/dd", label: "yyyy/mm/dd" },
  { value: "dd/mm/yy", label: "dd/mm/yy" },
  { value: "mm/dd/yy", label: "mm/dd/yy" },
  { value: "yy/mm/dd", label: "yy/mm/dd" },
  { value: "yy/dd/mm", label: "yy/dd/mm" },
];

const TEMPLATES = [
  {
    name: "Basic",
    desc: "Job link, company, role, date",
    fields: [
      { name: "Job Link", type: "url", required: true, autoExtract: "url" },
      { name: "Company", type: "text", required: true, autoExtract: "company" },
      { name: "Role", type: "text", required: true, autoExtract: "jobTitle" },
      {
        name: "Date Applied",
        type: "date",
        required: true,
        autoExtract: "dateApplied",
      },
    ],
  },
  {
    name: "Detailed",
    desc: "Adds location, salary, status, notes",
    fields: [
      { name: "Job Link", type: "url", required: true, autoExtract: "url" },
      { name: "Company", type: "text", required: true, autoExtract: "company" },
      { name: "Role", type: "text", required: true, autoExtract: "jobTitle" },
      {
        name: "Date Applied",
        type: "date",
        required: true,
        autoExtract: "dateApplied",
      },
      {
        name: "Location",
        type: "text",
        required: false,
        autoExtract: "location",
      },
      { name: "Salary", type: "text", required: false, autoExtract: "salary" },
      {
        name: "Status",
        type: "select",
        required: false,
        staticValue: "Applied",
        options: [
          "Applied",
          "Phone Screen",
          "Interview",
          "Offer",
          "Rejected",
          "Withdrawn",
        ],
      },
      { name: "Notes", type: "textarea", required: false },
    ],
  },
  {
    name: "Interview Pipeline",
    desc: "Track stages and contacts",
    fields: [
      { name: "Company", type: "text", required: true, autoExtract: "company" },
      { name: "Role", type: "text", required: true, autoExtract: "jobTitle" },
      {
        name: "Date Applied",
        type: "date",
        required: true,
        autoExtract: "dateApplied",
      },
      {
        name: "Status",
        type: "select",
        required: true,
        staticValue: "Applied",
        options: [
          "Applied",
          "Phone Screen",
          "Interview",
          "Offer",
          "Rejected",
          "Withdrawn",
        ],
      },
      { name: "Next Step", type: "text", required: false },
      { name: "Contact", type: "text", required: false },
    ],
  },
  {
    name: "Minimal",
    desc: "Company, role, status only",
    fields: [
      { name: "Company", type: "text", required: true, autoExtract: "company" },
      { name: "Role", type: "text", required: true, autoExtract: "jobTitle" },
      {
        name: "Status",
        type: "select",
        required: false,
        staticValue: "Applied",
        options: [
          "Applied",
          "Phone Screen",
          "Interview",
          "Offer",
          "Rejected",
          "Withdrawn",
        ],
      },
    ],
  },
];

let fields = [];
let sheetIdValue = "";
let tabNameValue = "";
let dirty = false;
let expandedIndex = null;
let draggedFieldIndex = null;

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(
    [CONFIG_STORAGE_KEY, "sheetId", "tabName", "fields"],
    (data) => {
      const config = readConfig(data);
      sheetIdValue = config.sheetId;
      tabNameValue = config.tabName || "Sheet1";
      fields = config.fields.map(normalizeField);
      renderMain();
      renderPreview();
      document.getElementById("saveBtn").addEventListener("click", saveConfig);
    },
  );
});

// ── Render ───────────────────────────────────────────────────────────────────

function renderMain() {
  const main = document.getElementById("settingsMain");
  main.innerHTML = "";
  main.appendChild(renderHeader());
  main.appendChild(renderDestinationCard());
  main.appendChild(renderFieldsCard());
  main.appendChild(renderTemplatesCard());
}

function renderHeader() {
  const el = document.createElement("div");
  el.className = "settings-header";
  el.innerHTML = `
    <div class="settings-header-inner">
      <div class="settings-mark">JF</div>
      <div>
        <h1 class="settings-title">Job Fill Settings</h1>
        <p class="settings-desc">Configure your Google Sheet destination and fields.</p>
      </div>
    </div>
  `;
  return el;
}

function renderDestinationCard() {
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `<span class="card-title">Destination</span>`;
  card.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "dest-grid";

  grid.appendChild(
    makeFormGroup(
      "Google Sheet ID",
      "sheetId",
      "text",
      sheetIdValue,
      "Paste the long ID from your Sheet URL",
      (val) => {
        sheetIdValue = val;
        markDirty();
        renderPreview();
      },
    ),
  );

  grid.appendChild(
    makeFormGroup(
      "Tab Name",
      "tabName",
      "text",
      tabNameValue,
      "Sheet1",
      (val) => {
        tabNameValue = val;
        markDirty();
        renderPreview();
      },
    ),
  );

  card.appendChild(grid);
  return card;
}

function renderFieldsCard() {
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card-head";
  const countEl = document.createElement("span");
  countEl.className = "card-count";
  countEl.textContent = `${fields.length} field${fields.length !== 1 ? "s" : ""}`;
  head.innerHTML = `<span class="card-title">Fields</span>`;
  head.appendChild(countEl);
  card.appendChild(head);

  const table = document.createElement("div");
  table.className = "fields-table";

  if (!fields.length) {
    const empty = document.createElement("div");
    empty.className = "fields-empty";
    empty.textContent = "No fields yet. Add one below or use a template.";
    table.appendChild(empty);
  } else {
    fields.forEach((field, index) => {
      table.appendChild(renderFieldRow(field, index));
    });
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-field-btn";
  addBtn.innerHTML = `<span class="add-icon">+</span> Add field`;
  addBtn.addEventListener("click", () => {
    fields.push({
      id: "",
      name: "",
      type: "text",
      required: false,
      prefillMode: "empty",
      autoExtract: "",
      staticValue: "",
      placeholder: "",
      options: [],
    });
    expandedIndex = fields.length - 1;
    markDirty();
    renderMain();
    renderPreview();
  });

  card.append(table, addBtn);
  return card;
}

function renderFieldRow(field, index) {
  const row = document.createElement("div");
  row.className = "field-row";
  row.draggable = true;

  row.addEventListener("dragstart", (e) => {
    draggedFieldIndex = index;
    row.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  });
  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
      row.classList.add("drag-over");
    }
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", (e) => {
    e.preventDefault();
    row.classList.remove("drag-over");
    if (draggedFieldIndex !== null && draggedFieldIndex !== index) {
      const [moved] = fields.splice(draggedFieldIndex, 1);
      fields.splice(index, 0, moved);
      draggedFieldIndex = null;
      expandedIndex = null;
      markDirty();
      renderMain();
      renderPreview();
    }
  });
  row.addEventListener("dragend", () => {
    draggedFieldIndex = null;
    document
      .querySelectorAll(".field-row")
      .forEach((r) => r.classList.remove("dragging", "drag-over"));
  });

  // Summary
  const summary = document.createElement("div");
  summary.className = "field-summary";

  const grip = document.createElement("span");
  grip.className = "field-grip";
  grip.textContent = "⠿";
  grip.title = "Drag to reorder";
  grip.addEventListener("mousedown", (e) => e.stopPropagation());

  const typeIcon = document.createElement("span");
  typeIcon.className = "field-type-icon";
  typeIcon.textContent = TYPE_ICONS[field.type] || "T";
  typeIcon.title = field.type;

  const nameText = document.createElement("span");
  nameText.className = "field-name-text";
  nameText.textContent = field.name || "(unnamed)";

  const pills = document.createElement("span");
  pills.className = "field-pills";

  if (field.required) {
    const p = document.createElement("span");
    p.className = "pill pill-required";
    p.textContent = "required";
    pills.appendChild(p);
  }
  if (field.autoExtract) {
    const opt = AUTO_EXTRACT_OPTIONS.find((o) => o.value === field.autoExtract);
    const p = document.createElement("span");
    p.className = "pill pill-auto";
    p.textContent = opt ? `auto` : "auto";
    p.title = opt ? opt.label : field.autoExtract;
    pills.appendChild(p);
  } else if (field.prefillMode === "static" || field.staticValue) {
    const p = document.createElement("span");
    p.className = "pill pill-preset";
    p.textContent = `preset`;
    p.title = field.staticValue;
    pills.appendChild(p);
  }

  const colLetter = String.fromCharCode(65 + index);
  const meta = document.createElement("span");
  meta.className = "field-meta";
  meta.textContent = `${field.type} · col ${colLetter}`;

  const isExpanded = expandedIndex === index;

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "field-expand-btn";
  expandBtn.innerHTML = isExpanded ? "▲" : "▼";
  expandBtn.title = isExpanded ? "Collapse" : "Edit";
  expandBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    expandedIndex = isExpanded ? null : index;
    renderMain();
  });

  summary.append(grip, typeIcon, nameText, pills, meta, expandBtn);
  summary.addEventListener("click", () => {
    expandedIndex = isExpanded ? null : index;
    renderMain();
  });

  row.appendChild(summary);

  if (isExpanded) {
    row.appendChild(renderFieldDetail(field, index));
  }

  return row;
}

function renderFieldDetail(field, index) {
  const detail = document.createElement("div");
  detail.className = "field-detail";

  // Name + Type grid
  const topGrid = document.createElement("div");
  topGrid.className = "detail-grid";

  // Name input
  const nameGroup = document.createElement("div");
  nameGroup.className = "detail-group";
  const nameLbl = document.createElement("label");
  nameLbl.className = "detail-label";
  nameLbl.textContent = "Field name";
  const nameInput = document.createElement("input");
  nameInput.className = "form-input";
  nameInput.type = "text";
  nameInput.value = field.name;
  nameInput.placeholder = "e.g. Job Title";
  nameInput.addEventListener("input", () => {
    field.name = nameInput.value;
    if (!field.id) {
      field.id = makeUniqueId(slugify(field.name), index);
    }
    markDirty();
    renderPreview();
  });
  nameInput.addEventListener("change", () => {
    if (!field.id || field.id === slugify(field.name)) {
      field.id = makeUniqueId(slugify(field.name), index);
    }
    renderMain();
  });
  nameGroup.append(nameLbl, nameInput);

  // Type select
  const typeGroup = document.createElement("div");
  typeGroup.className = "detail-group";
  const typeLbl = document.createElement("label");
  typeLbl.className = "detail-label";
  typeLbl.textContent = "Type";
  const typeSelect = document.createElement("select");
  typeSelect.className = "form-input";
  FIELD_TYPES.forEach((ft) => {
    const opt = document.createElement("option");
    opt.value = ft.value;
    opt.textContent = ft.label;
    if (ft.value === field.type) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("change", () => {
    field.type = typeSelect.value;
    markDirty();
    renderMain();
    renderPreview();
  });
  typeGroup.append(typeLbl, typeSelect);

  topGrid.append(nameGroup, typeGroup);
  detail.appendChild(topGrid);

  // Required checkbox
  const reqGroup = document.createElement("div");
  reqGroup.className = "detail-group detail-group-inline";
  const reqCbk = document.createElement("input");
  reqCbk.type = "checkbox";
  reqCbk.id = `req-${index}`;
  reqCbk.checked = field.required;
  reqCbk.addEventListener("change", () => {
    field.required = reqCbk.checked;
    markDirty();
    renderPreview();
  });
  const reqLbl = document.createElement("label");
  reqLbl.htmlFor = `req-${index}`;
  reqLbl.textContent = "Required field";
  reqGroup.append(reqCbk, reqLbl);
  detail.appendChild(reqGroup);

  // Pre-fill source segmented control
  const prefillGroup = document.createElement("div");
  prefillGroup.className = "detail-group";
  const prefillLbl = document.createElement("label");
  prefillLbl.className = "detail-label";
  prefillLbl.textContent = "Pre-fill source";

  let prefillMode = field.prefillMode || "empty";
  if (!field.prefillMode) {
    if (field.autoExtract) prefillMode = "auto";
    else if (field.staticValue) prefillMode = "static";
  }

  const seg = document.createElement("div");
  seg.className = "seg-ctrl";

  [
    { value: "auto", label: "Auto from page" },
    { value: "static", label: "Static value" },
    { value: "empty", label: "Empty" },
  ].forEach((so) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn" + (prefillMode === so.value ? " active" : "");
    btn.textContent = so.label;
    btn.addEventListener("click", () => {
      prefillMode = so.value;
      field.prefillMode = so.value;
      if (so.value === "empty") {
        field.autoExtract = "";
        field.staticValue = "";
      } else if (so.value === "auto") {
        field.staticValue = "";
      } else if (so.value === "static") {
        field.autoExtract = "";
      }
      markDirty();
      renderMain();
      renderPreview();
    });
    seg.appendChild(btn);
  });

  prefillGroup.append(prefillLbl, seg);
  detail.appendChild(prefillGroup);

  // Conditional: extract source or static value input
  if (prefillMode === "auto") {
    const autoGroup = document.createElement("div");
    autoGroup.className = "detail-group";
    const autoLbl = document.createElement("label");
    autoLbl.className = "detail-label";
    autoLbl.textContent = "Extract from";
    const autoSelect = document.createElement("select");
    autoSelect.className = "form-input";
    AUTO_EXTRACT_OPTIONS.forEach((ao) => {
      const opt = document.createElement("option");
      opt.value = ao.value;
      opt.textContent = ao.label;
      if (ao.value === field.autoExtract) opt.selected = true;
      autoSelect.appendChild(opt);
    });
    autoSelect.addEventListener("change", () => {
      field.autoExtract = autoSelect.value;
      markDirty();
      renderMain();
      renderPreview();
    });
    autoGroup.append(autoLbl, autoSelect);
    detail.appendChild(autoGroup);

    if (field.autoExtract === "dateApplied") {
      const fmtGroup = document.createElement("div");
      fmtGroup.className = "detail-group";
      const fmtLbl = document.createElement("label");
      fmtLbl.className = "detail-label";
      fmtLbl.textContent = "Date format";
      const fmtSelect = document.createElement("select");
      fmtSelect.className = "form-input";
      DATE_FORMAT_OPTIONS.forEach((fo) => {
        const opt = document.createElement("option");
        opt.value = fo.value;
        opt.textContent = fo.label;
        if (fo.value === (field.dateFormat || "dd/mm/yyyy"))
          opt.selected = true;
        fmtSelect.appendChild(opt);
      });
      fmtSelect.addEventListener("change", () => {
        field.dateFormat = fmtSelect.value;
        markDirty();
        renderPreview();
      });
      fmtGroup.append(fmtLbl, fmtSelect);
      detail.appendChild(fmtGroup);

      const sepGroup = document.createElement("div");
      sepGroup.className = "detail-group";
      const sepLbl = document.createElement("label");
      sepLbl.className = "detail-label";
      sepLbl.textContent = "Separator";
      const sepInput = document.createElement("input");
      sepInput.className = "form-input";
      sepInput.type = "text";
      sepInput.maxLength = 3;
      sepInput.value =
        typeof field.dateSeparator === "string" ? field.dateSeparator : "/";
      sepInput.placeholder = "/";
      sepInput.addEventListener("input", () => {
        field.dateSeparator = sepInput.value;
        markDirty();
        renderPreview();
      });
      sepGroup.append(sepLbl, sepInput);
      detail.appendChild(sepGroup);
    }
  } else if (prefillMode === "static") {
    const staticGroup = document.createElement("div");
    staticGroup.className = "detail-group";
    const staticLbl = document.createElement("label");
    staticLbl.className = "detail-label";
    staticLbl.textContent = "Static value";
    const staticInput = document.createElement("input");
    staticInput.className = "form-input";
    staticInput.type = "text";
    staticInput.value = field.staticValue || "";
    staticInput.placeholder = "e.g. Applied";
    staticInput.addEventListener("input", () => {
      field.staticValue = staticInput.value;
      markDirty();
      renderPreview();
    });
    staticGroup.append(staticLbl, staticInput);
    detail.appendChild(staticGroup);
  }

  // Options textarea (select type only)
  if (field.type === "select") {
    const optsGroup = document.createElement("div");
    optsGroup.className = "detail-group";
    const optsLbl = document.createElement("label");
    optsLbl.className = "detail-label";
    optsLbl.textContent = "Options (one per line)";
    const optsArea = document.createElement("textarea");
    optsArea.className = "form-input";
    optsArea.value = (field.options || []).join("\n");
    optsArea.placeholder = "Applied\nInterview\nOffer\nRejected";
    optsArea.rows = 4;
    optsArea.addEventListener("input", () => {
      field.options = optsArea.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      markDirty();
    });
    optsGroup.append(optsLbl, optsArea);
    detail.appendChild(optsGroup);
  }

  // Remove button
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "Remove field";
  removeBtn.addEventListener("click", () => {
    fields.splice(index, 1);
    if (expandedIndex === index) expandedIndex = null;
    else if (expandedIndex !== null && expandedIndex > index) expandedIndex--;
    markDirty();
    renderMain();
    renderPreview();
  });
  detail.appendChild(removeBtn);

  return detail;
}

function renderTemplatesCard() {
  const card = document.createElement("div");
  card.className = "card";

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `<span class="card-title">Templates</span><span class="card-desc">Quick-start with a pre-configured field set</span>`;
  card.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "templates-grid";

  TEMPLATES.forEach((tmpl) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "template-btn";
    btn.innerHTML = `<span class="tmpl-name">${escapeHtml(tmpl.name)}</span><span class="tmpl-desc">${escapeHtml(tmpl.desc)}</span>`;
    btn.addEventListener("click", () => applyTemplate(tmpl));
    grid.appendChild(btn);
  });

  card.appendChild(grid);
  return card;
}

function renderPreview() {
  const frame = document.getElementById("previewFrame");
  if (!frame) return;

  const isSetup = !sheetIdValue || !tabNameValue || fields.length === 0;
  const requiredFields = fields.filter((f) => f.required);
  const optionalFields = fields.filter((f) => !f.required);

  if (isSetup) {
    frame.innerHTML = `
      <div class="prev-popup">
        <div class="prev-head">
          <div class="prev-mark">JF</div>
          <span>Job Fill</span>
          <span class="prev-gear">⚙</span>
        </div>
        <div class="prev-body">
          <div class="prev-setup">Finish setup to get started</div>
        </div>
      </div>
    `;
    return;
  }

  const reqHtml = requiredFields
    .map((f) => {
      const isAuto = Boolean(f.autoExtract);
      return `
      <div class="prev-field">
        <div class="prev-label">${escapeHtml(f.name)} *</div>
        <div class="prev-input${isAuto ? " prev-auto" : ""}">
          ${isAuto ? `<span class="prev-badge">auto</span>` : escapeHtml(f.staticValue || "")}
        </div>
      </div>
    `;
    })
    .join("");

  const optHtml = optionalFields.length
    ? `<div class="prev-more">+ ${optionalFields.length} optional field${optionalFields.length !== 1 ? "s" : ""}</div>`
    : "";

  frame.innerHTML = `
    <div class="prev-popup">
      <div class="prev-head">
        <div class="prev-mark">JF</div>
        <span>Job Fill</span>
        <span class="prev-gear">⚙</span>
      </div>
      <div class="prev-body">${reqHtml}${optHtml}</div>
      <div class="prev-foot">Add to sheet ↵</div>
    </div>
  `;
}

// ── Templates ────────────────────────────────────────────────────────────────

function applyTemplate(tmpl) {
  if (
    fields.length > 0 &&
    !confirm(`Replace current fields with the "${tmpl.name}" template?`)
  )
    return;
  fields = inflateTemplate(tmpl);
  expandedIndex = null;
  markDirty();
  renderMain();
  renderPreview();
}

function inflateTemplate(tmpl) {
  const result = [];
  tmpl.fields.forEach((f) => {
    const base = slugify(f.name);
    let id = base;
    let suffix = 2;
    while (result.some((r) => r.id === id)) {
      id = `${base}-${suffix}`;
      suffix++;
    }
    result.push({
      id,
      name: f.name,
      type: f.type || "text",
      required: f.required !== false,
      prefillMode: f.autoExtract ? "auto" : f.staticValue ? "static" : "empty",
      autoExtract: f.autoExtract || "",
      staticValue: f.staticValue || "",
      placeholder: f.placeholder || "",
      options: Array.isArray(f.options) ? f.options : [],
    });
  });
  return result;
}

// ── Save state ───────────────────────────────────────────────────────────────

function markDirty() {
  dirty = true;
  const bar = document.getElementById("saveBar");
  const status = document.getElementById("saveStatus");
  if (bar) bar.classList.add("dirty");
  if (status) status.textContent = "Unsaved changes";
}

function markSaved() {
  dirty = false;
  const bar = document.getElementById("saveBar");
  const status = document.getElementById("saveStatus");
  if (bar) bar.classList.remove("dirty");
  if (status) {
    status.textContent = "✓ Saved";
    setTimeout(() => {
      if (!dirty && status) status.textContent = "";
    }, 2500);
  }
}

function saveConfig() {
  // Auto-assign IDs
  fields.forEach((field, i) => {
    if (!field.id) field.id = makeUniqueId(slugify(field.name), i);
    if (!field.name) field.name = `field-${i + 1}`;
  });

  const errors = validateConfig({
    sheetId: sheetIdValue,
    tabName: tabNameValue,
    fields,
  });
  const statusEl = document.getElementById("saveStatus");

  if (errors.length) {
    if (statusEl) statusEl.textContent = errors[0];
    return;
  }

  const config = {
    sheetId: sheetIdValue,
    tabName: tabNameValue,
    fields: fields.map((f) => ({
      id: f.id.trim(),
      name: f.name.trim(),
      type: f.type || "text",
      required: Boolean(f.required),
      prefillMode:
        f.prefillMode ||
        (f.autoExtract ? "auto" : f.staticValue ? "static" : "empty"),
      autoExtract: f.autoExtract || "",
      staticValue: f.staticValue || "",
      placeholder: f.placeholder || "",
      options: Array.isArray(f.options) ? f.options : [],
      dateFormat: f.dateFormat || "dd/mm/yyyy",
      dateSeparator:
        typeof f.dateSeparator === "string" ? f.dateSeparator : "/",
    })),
  };

  chrome.storage.sync.set({ [CONFIG_STORAGE_KEY]: config }, () => {
    if (chrome.runtime.lastError) {
      if (statusEl) statusEl.textContent = chrome.runtime.lastError.message;
      return;
    }
    fields = config.fields;
    markSaved();
    renderMain();
    renderPreview();
  });
}

// ── Utilities ────────────────────────────────────────────────────────────────

function makeFormGroup(labelText, id, type, value, placeholder, onInput) {
  const group = document.createElement("div");
  group.className = "form-group";

  const lbl = document.createElement("label");
  lbl.className = "form-label";
  lbl.htmlFor = id;
  lbl.textContent = labelText;

  const input = document.createElement("input");
  input.id = id;
  input.className = "form-input";
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener("input", () => onInput(input.value.trim()));

  group.append(lbl, input);
  return group;
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

  const prefillMode =
    field.prefillMode ||
    (autoExtract ? "auto" : staticValue ? "static" : "empty");

  return {
    id: typeof field.id === "string" ? field.id : "",
    name:
      typeof field.name === "string"
        ? field.name
        : typeof field.label === "string"
          ? field.label
          : "",
    type: FIELD_TYPES.some((t) => t.value === field.type) ? field.type : "text",
    required: Boolean(field.required),
    prefillMode: ["auto", "static", "empty"].includes(prefillMode)
      ? prefillMode
      : "empty",
    autoExtract,
    staticValue,
    placeholder: field.placeholder || "",
    options: Array.isArray(field.options) ? field.options : [],
    dateFormat: field.dateFormat || "dd/mm/yyyy",
    dateSeparator:
      typeof field.dateSeparator === "string" ? field.dateSeparator : "/",
  };
}

function readConfig(data) {
  const storedConfig = data[CONFIG_STORAGE_KEY] || {};
  return {
    sheetId: storedConfig.sheetId || data.sheetId || "",
    tabName: storedConfig.tabName || data.tabName || "",
    fields: Array.isArray(storedConfig.fields)
      ? storedConfig.fields
      : Array.isArray(data.fields)
        ? data.fields
        : [],
  };
}

function validateConfig(config) {
  const errors = [];
  if (!config.sheetId) errors.push("Sheet ID is required.");
  if (!config.tabName) errors.push("Tab name is required.");
  if (!config.fields.length) errors.push("At least one field is required.");
  config.fields.forEach((f, i) => {
    if (!f.name) errors.push(`Field ${i + 1} needs a name.`);
  });
  return errors;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeUniqueId(base, excludeIdx) {
  const fallback = base || `field-${fields.length + 1}`;
  let candidate = fallback;
  let suffix = 2;
  while (fields.some((f, i) => i !== excludeIdx && f.id === candidate)) {
    candidate = `${fallback}-${suffix}`;
    suffix++;
  }
  return candidate;
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
    normalizeField,
    readConfig,
    validateConfig,
    slugify,
    makeUniqueId,
  };
}
