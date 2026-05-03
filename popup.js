document.addEventListener("DOMContentLoaded", async () => {
  const configStorageKey = "jobFillConfig";
  const setupPrompt = document.getElementById("setupPrompt");
  const form = document.getElementById("form");
  const visibleFields = document.getElementById("visibleFields");
  const optionalFields = document.getElementById("optionalFields");
  const seeMoreButton = document.getElementById("seeMore");
  const setupSettingsButton = document.getElementById("setupSettings");
  const openSettingsButton = document.getElementById("openSettings");
  const submitButton = document.getElementById("submit");
  const statusDiv = document.getElementById("status");

  const storageData = await getStorage([
    configStorageKey,
    "sheetId",
    "tabName",
    "fields",
  ]);
  const config = readConfig(storageData, configStorageKey);
  const fields = Array.isArray(config.fields) ? config.fields : [];
  const tab = await getActiveTab();
  const detectedValues = await getDetectedValues(tab);
  const valuesByFieldId = {};

  setupSettingsButton.addEventListener("click", openOptionsPage);
  openSettingsButton.addEventListener("click", openOptionsPage);

  if (!config.sheetId || !config.tabName || fields.length === 0) {
    setupPrompt.style.display = "block";
    form.style.display = "none";
    showStatus("Open settings to finish setup.", "error");
    return;
  }

  renderFields(fields, tab, detectedValues, valuesByFieldId);

  seeMoreButton.addEventListener("click", () => {
    const isHidden =
      optionalFields.style.display === "none" || !optionalFields.style.display;
    optionalFields.style.display = isHidden ? "block" : "none";
    seeMoreButton.textContent = isHidden
      ? "Hide optional fields"
      : "See more fields";
  });

  submitButton.addEventListener("click", () => {
    const missingRequired = fields.filter(
      (field) =>
        field.required && !String(valuesByFieldId[field.id] || "").trim(),
    );

    if (missingRequired.length) {
      showStatus(
        `Required: ${missingRequired.map((field) => field.label).join(", ")}`,
        "error",
      );
      return;
    }

    submitButton.disabled = true;
    showStatus("Submitting...", "");

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
        submitButton.disabled = false;
        if (response && response.success) {
          showStatus("Success! Appended to Sheet.", "success");
        } else {
          const errorMsg = response ? response.error : "Unknown error";
          showStatus(`Error: ${errorMsg}`, "error");
        }
      },
    );
  });

  function renderFields(allFields, activeTab, detected, fieldValues) {
    const popupFields = allFields.filter(
      (field) => field.visibleInPopup !== false,
    );
    const requiredFields = popupFields.filter((field) => field.required);
    const optionalPopupFields = popupFields.filter((field) => !field.required);

    allFields.forEach((field) => {
      fieldValues[field.id] = getAutofillValue(field, activeTab, detected);
    });

    requiredFields.forEach((field) => {
      visibleFields.appendChild(createFieldInput(field, fieldValues));
    });

    optionalPopupFields.forEach((field) => {
      optionalFields.appendChild(createFieldInput(field, fieldValues));
    });

    if (optionalPopupFields.length) {
      seeMoreButton.style.display = "inline-block";
    }

    if (!requiredFields.length && optionalPopupFields.length) {
      optionalFields.style.display = "block";
      seeMoreButton.style.display = "none";
    }
  }

  function createFieldInput(field, fieldValues) {
    const group = document.createElement("div");
    group.className = "form-group";

    const label = document.createElement("label");
    label.htmlFor = `field-${field.id}`;
    label.textContent = field.required ? `${field.label} *` : field.label;

    const input = document.createElement("input");
    input.id = `field-${field.id}`;
    input.type = "text";
    input.value = fieldValues[field.id] || "";
    input.placeholder = field.label;
    input.addEventListener("input", () => {
      fieldValues[field.id] = input.value.trim();
    });

    group.append(label, input);
    return group;
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
});

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function readConfig(data, configStorageKey) {
  const storedConfig = data[configStorageKey] || {};

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

async function getActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab || null;
  } catch (err) {
    console.error("Active tab error:", err);
    return null;
  }
}

function getDetectedValues(tab) {
  return new Promise((resolve) => {
    if (!tab?.id) {
      resolve({});
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "extractData" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Message error:", chrome.runtime.lastError.message);
        resolve({});
        return;
      }

      resolve(response || {});
    });
  });
}

function getAutofillValue(field, tab, detectedValues) {
  const sourceValue = getSourceAutofillValue(field, tab, detectedValues);

  if (String(sourceValue || "").trim()) {
    return sourceValue;
  }

  return field.defaultValueEnabled ? field.defaultValue || "" : "";
}

function getSourceAutofillValue(field, tab, detectedValues) {
  switch (field.autofillSource) {
    case "currentUrl":
      return tab?.url || "";
    case "role":
      return detectedValues.role || "";
    case "organization":
      return detectedValues.organization || "";
    case "location":
      return detectedValues.location || "";
    case "salary":
      return detectedValues.salary || "";
    case "today":
      return formatToday();
    default:
      return "";
  }
}

function formatToday() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
}
