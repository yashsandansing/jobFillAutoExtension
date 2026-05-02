document.addEventListener('DOMContentLoaded', async () => {
  const orgInput = document.getElementById('organization');
  const roleInput = document.getElementById('role');
  const linkInput = document.getElementById('jobLink');
  const sheetIdInput = document.getElementById('sheetId');
  const tabNameInput = document.getElementById('tabName');
  const submitBtn = document.getElementById('submit');
  const statusDiv = document.getElementById('status');
  const toggleBtn = document.getElementById('toggleSettings');
  const settingsDiv = document.getElementById('settings');

  // Load saved settings
  chrome.storage.sync.get(['sheetId', 'tabName'], (data) => {
    if (data.sheetId) sheetIdInput.value = data.sheetId;
    if (data.tabName) tabNameInput.value = data.tabName;
  });

  // Toggle settings visibility
  toggleBtn.addEventListener('click', () => {
    const isHidden = settingsDiv.style.display === 'none' || !settingsDiv.style.display;
    settingsDiv.style.display = isHidden ? 'block' : 'none';
    toggleBtn.textContent = isHidden ? 'Sheet Settings (Collapse)' : 'Sheet Settings (Expand)';
  });

  // Extract data from the active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      linkInput.value = tab.url;
      
      // Request data from content script
      chrome.tabs.sendMessage(tab.id, { action: "extractData" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
          return;
        }
        if (response) {
          if (response.role) roleInput.value = response.role;
          if (response.organization) orgInput.value = response.organization;
        }
      });
    }
  } catch (err) {
    console.error("Popup data extraction error:", err);
  }

  // Handle submission
  submitBtn.addEventListener('click', async () => {
    const data = {
      organization: orgInput.value.trim(),
      role: roleInput.value.trim(),
      jobLink: linkInput.value.trim(),
      sheetId: sheetIdInput.value.trim(),
      tabName: tabNameInput.value.trim() || 'Sheet1'
    };

    if (!data.organization || !data.role || !data.sheetId) {
      showStatus('Organization, Role, and Sheet ID are required.', 'error');
      return;
    }

    // Save Sheet ID and Tab Name for next time
    chrome.storage.sync.set({ sheetId: data.sheetId, tabName: data.tabName });

    showStatus('Submitting...', '');
    submitBtn.disabled = true;

    chrome.runtime.sendMessage({ action: "appendToSheet", payload: data }, (response) => {
      submitBtn.disabled = false;
      if (response && response.success) {
        showStatus('Success! Appended to Sheet.', 'success');
      } else {
        const errorMsg = response ? response.error : 'Unknown error';
        showStatus('Error: ' + errorMsg, 'error');
      }
    });
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
  }
});
