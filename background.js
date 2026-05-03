chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "appendToSheet") {
    handleAppend(message.payload, sendResponse);
    return true; // Keep message channel open for async response
  }
});

async function handleAppend(data, sendResponse) {
  try {
    const token = await getAuthToken();
    const result = await appendToGoogleSheet(token, data);
    sendResponse({ success: true, result });
  } catch (err) {
    console.error("Append error:", err);
    sendResponse({ success: false, error: err.message || err.toString() });
  }
}

function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

async function appendToGoogleSheet(token, data) {
  const config = await loadAppendConfig(data);
  const row = config.fields.map((field) => (
    config.valuesByFieldId[field.id] || ""
  ));

  const encodedRange = encodeURIComponent(`${config.tabName}!A:A`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.sheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: `${config.tabName}!A:A`,
      majorDimension: "ROWS",
      values: [row]
    })
  });

  if (!response.ok) {
    const errBody = await response.json();
    throw new Error(errBody.error ? errBody.error.message : response.statusText);
  }

  return await response.json();
}

async function loadAppendConfig(data) {
  const storedConfig = await getStoredConfig();
  const sheetId = data.sheetId || storedConfig.sheetId;
  const tabName = data.tabName || storedConfig.tabName;
  const fields = Array.isArray(data.fields) && data.fields.length
    ? data.fields
    : storedConfig.fields;
  const valuesByFieldId = data.valuesByFieldId || {};

  if (!sheetId) {
    throw new Error("Google Sheet ID is required.");
  }

  if (!tabName) {
    throw new Error("Tab name is required.");
  }

  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("At least one configured field is required.");
  }

  return {
    sheetId,
    tabName,
    fields,
    valuesByFieldId
  };
}

function getStoredConfig() {
  const configStorageKey = 'jobFillConfig';

  return new Promise((resolve) => {
    chrome.storage.sync.get([configStorageKey, 'sheetId', 'tabName', 'fields'], (data) => {
      const storedConfig = data[configStorageKey] || {};

      resolve({
        sheetId: storedConfig.sheetId || data.sheetId || '',
        tabName: storedConfig.tabName || data.tabName || '',
        fields: Array.isArray(storedConfig.fields)
          ? storedConfig.fields
          : (Array.isArray(data.fields) ? data.fields : [])
      });
    });
  });
}
