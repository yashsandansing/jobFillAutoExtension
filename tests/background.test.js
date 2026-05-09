const {
  getAuthToken,
  getStoredConfig,
  loadAppendConfig,
  appendToGoogleSheet,
  handleAppend,
} = require("../background");

function mockStorage(data) {
  chrome.storage.sync.get.mockImplementation((_, callback) => callback(data));
}

describe("background helpers", () => {
  beforeEach(() => {
    chrome.runtime.lastError = null;
    global.fetch = jest.fn();
  });

  test("resolves auth token and rejects runtime errors", async () => {
    chrome.identity.getAuthToken.mockImplementationOnce((_, callback) =>
      callback("token-1"),
    );
    await expect(getAuthToken()).resolves.toBe("token-1");

    chrome.identity.getAuthToken.mockImplementationOnce((_, callback) => {
      chrome.runtime.lastError = { message: "auth failed" };
      callback();
    });
    await expect(getAuthToken()).rejects.toEqual({ message: "auth failed" });
  });

  test("reads namespaced config with legacy fallback", async () => {
    mockStorage({
      sheetId: "legacy-sheet",
      tabName: "Legacy",
      fields: [{ id: "legacy" }],
      jobFillConfig: {
        sheetId: "new-sheet",
        tabName: "Applications",
        fields: [{ id: "role" }],
      },
    });

    await expect(getStoredConfig()).resolves.toEqual({
      sheetId: "new-sheet",
      tabName: "Applications",
      fields: [{ id: "role" }],
    });
  });

  test("loads append config from payload with stored fallback and validates required pieces", async () => {
    mockStorage({
      jobFillConfig: {
        sheetId: "stored-sheet",
        tabName: "StoredTab",
        fields: [{ id: "company" }],
      },
    });

    await expect(
      loadAppendConfig({
        valuesByFieldId: { company: "Acme" },
      }),
    ).resolves.toEqual({
      sheetId: "stored-sheet",
      tabName: "StoredTab",
      fields: [{ id: "company" }],
      valuesByFieldId: { company: "Acme" },
    });

    mockStorage({ jobFillConfig: {} });
    await expect(
      loadAppendConfig({ tabName: "Sheet1", fields: [{ id: "role" }] }),
    ).rejects.toThrow("Google Sheet ID is required.");
    await expect(
      loadAppendConfig({ sheetId: "sheet", fields: [{ id: "role" }] }),
    ).rejects.toThrow("Tab name is required.");
    await expect(
      loadAppendConfig({ sheetId: "sheet", tabName: "Sheet1" }),
    ).rejects.toThrow("At least one configured field is required.");
  });

  test("appends fields to Google Sheets in configured order", async () => {
    mockStorage({});
    fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ updates: { updatedRows: 1 } }),
    });

    await expect(
      appendToGoogleSheet("token-1", {
        sheetId: "sheet id",
        tabName: "Applications 2026",
        fields: [{ id: "company" }, { id: "role" }, { id: "notes" }],
        valuesByFieldId: { role: "Engineer", company: "Acme" },
      }),
    ).resolves.toEqual({ updates: { updatedRows: 1 } });

    expect(fetch).toHaveBeenCalledWith(
      "https://sheets.googleapis.com/v4/spreadsheets/sheet id/values/Applications%202026!A%3AA:append?valueInputOption=USER_ENTERED",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: "Applications 2026!A:A",
          majorDimension: "ROWS",
          values: [["Acme", "Engineer", ""]],
        }),
      },
    );
  });

  test("throws Sheets API error messages and reports handleAppend failures", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockStorage({});
    fetch.mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Request",
      json: jest
        .fn()
        .mockResolvedValue({ error: { message: "Invalid range" } }),
    });

    await expect(
      appendToGoogleSheet("token-1", {
        sheetId: "sheet",
        tabName: "Sheet1",
        fields: [{ id: "role" }],
        valuesByFieldId: { role: "Engineer" },
      }),
    ).rejects.toThrow("Invalid range");

    chrome.identity.getAuthToken.mockImplementationOnce((_, callback) => {
      chrome.runtime.lastError = { message: "auth failed" };
      callback();
    });
    const sendResponse = jest.fn();
    await handleAppend(
      { sheetId: "sheet", tabName: "Sheet1", fields: [{ id: "role" }] },
      sendResponse,
    );

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: "auth failed",
    });
  });
});
