const {
  readConfig,
  getActiveTab,
  getDetectedValues,
  getAutofillValue,
  getSourceAutoValue,
  normalizeField,
  formatTodayWithOptions,
} = require("../popup/popup");

describe("popup helpers", () => {
  beforeEach(() => {
    chrome.runtime.lastError = null;
  });

  test("reads config from the namespaced storage key", () => {
    const config = readConfig(
      {
        jobFillConfig: {
          sheetId: "sheet-1",
          tabName: "Applications",
          fields: [{ id: "role" }],
        },
      },
      "jobFillConfig",
    );

    expect(config).toEqual({
      sheetId: "sheet-1",
      tabName: "Applications",
      fields: [{ id: "role" }],
    });
  });

  test("normalizes legacy field properties", () => {
    expect(
      normalizeField({
        id: 123,
        label: "Company",
        autofillSource: "organization",
        defaultValueEnabled: true,
        defaultValue: "Applied",
        required: 1,
        options: "not-array",
      }),
    ).toEqual({
      id: "",
      name: "Company",
      type: "text",
      required: true,
      autoExtract: "company",
      staticValue: "Applied",
      placeholder: "",
      options: [],
      dateFormat: "dd/mm/yyyy",
      dateSeparator: "/",
    });
  });

  test("returns detected, tab, date, and static autofill values", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-07T12:00:00-04:00"));
    const tab = { url: "https://example.com/job" };
    const detected = {
      role: "Engineer",
      organization: "Acme",
      location: "Remote",
      salary: "$100k",
    };

    expect(getSourceAutoValue({ autoExtract: "jobTitle" }, tab, detected)).toBe("Engineer");
    expect(getSourceAutoValue({ autoExtract: "company" }, tab, detected)).toBe("Acme");
    expect(getSourceAutoValue({ autoExtract: "location" }, tab, detected)).toBe("Remote");
    expect(getSourceAutoValue({ autoExtract: "salary" }, tab, detected)).toBe("$100k");
    expect(getSourceAutoValue({ autoExtract: "url" }, tab, detected)).toBe("https://example.com/job");
    expect(getSourceAutoValue({ autoExtract: "dateApplied" }, tab, detected)).toBe("07/05/2026");
    expect(getAutofillValue({ autoExtract: "unknown", staticValue: "Manual" }, tab, detected)).toBe("Manual");
    expect(formatTodayWithOptions("dd/mm/yyyy", "/")).toBe("07/05/2026");
    expect(formatTodayWithOptions("mm/dd/yyyy", "/")).toBe("05/07/2026");
    expect(formatTodayWithOptions("yyyy/mm/dd", "-")).toBe("2026-05-07");
    expect(formatTodayWithOptions("dd/mm/yy", ".")).toBe("07.05.26");
    expect(formatTodayWithOptions("yy/dd/mm", "/")).toBe("26/07/05");
    jest.useRealTimers();
  });

  test("gets active tab and swallows tab query errors", async () => {
    chrome.tabs.query.mockResolvedValueOnce([{ id: 1, url: "https://example.com" }]);
    await expect(getActiveTab()).resolves.toEqual({ id: 1, url: "https://example.com" });

    chrome.tabs.query.mockRejectedValueOnce(new Error("no tabs"));
    await expect(getActiveTab()).resolves.toBeNull();
  });

  test("gets detected values from content script and returns empty values on errors", async () => {
    chrome.tabs.sendMessage.mockImplementationOnce((tabId, message, callback) => {
      callback({ role: "Engineer" });
    });
    await expect(getDetectedValues({ id: 7 })).resolves.toEqual({ role: "Engineer" });

    chrome.tabs.sendMessage.mockImplementationOnce((tabId, message, callback) => {
      chrome.runtime.lastError = { message: "missing receiver" };
      callback();
    });
    await expect(getDetectedValues({ id: 7 })).resolves.toEqual({});

    chrome.runtime.lastError = null;
    await expect(getDetectedValues(null)).resolves.toEqual({});
  });
});
