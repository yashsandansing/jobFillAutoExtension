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
  const { organization, role, jobLink, sheetId, tabName } = data;
  const now = new Date();
  const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  
  // Row structure: 14 columns
  // JOB LINK | ORGANIZATION | ROLE | Date | Company URL | STATUS | RECRUITER 1-5 | ADDITIONAL RECRUITERS | Recruiter Email Status | Notes
  const row = [
    jobLink,
    organization,
    role,
    today,
    "",             // Company URL
    "Applied",      // STATUS
    "", "", "", "", "", // RECRUITER 1-5
    "",             // ADDITIONAL RECRUITERS
    "",             // Recruiter Email Status
    ""              // Notes
  ];

  const encodedRange = encodeURIComponent(`${tabName}!A:A`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      range: `${tabName}!A:A`,
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
