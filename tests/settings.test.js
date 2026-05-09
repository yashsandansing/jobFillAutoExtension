const {
  normalizeField,
  readConfig,
  validateConfig,
  slugify,
  makeUniqueId,
} = require("../settings/settings");

describe("settings helpers", () => {
  test("reads namespaced config before legacy storage values", () => {
    expect(
      readConfig({
        sheetId: "legacy-sheet",
        tabName: "Legacy",
        fields: [{ id: "legacy" }],
        jobFillConfig: {
          sheetId: "new-sheet",
          tabName: "Applications",
          fields: [{ id: "role" }],
        },
      }),
    ).toEqual({
      sheetId: "new-sheet",
      tabName: "Applications",
      fields: [{ id: "role" }],
    });
  });

  test("falls back to legacy config values", () => {
    expect(
      readConfig({
        sheetId: "legacy-sheet",
        tabName: "Legacy",
        fields: [{ id: "legacy" }],
      }),
    ).toEqual({
      sheetId: "legacy-sheet",
      tabName: "Legacy",
      fields: [{ id: "legacy" }],
    });
  });

  test("normalizes supported fields and defaults unsupported field types", () => {
    expect(
      normalizeField({
        id: "status",
        name: "Status",
        type: "select",
        required: false,
        prefillMode: "static",
        autoExtract: "",
        staticValue: "Applied",
        placeholder: "Choose",
        options: ["Applied", "Interview"],
      }),
    ).toEqual({
      id: "status",
      name: "Status",
      type: "select",
      required: false,
      prefillMode: "static",
      autoExtract: "",
      staticValue: "Applied",
      placeholder: "Choose",
      options: ["Applied", "Interview"],
      dateFormat: "dd/mm/yyyy",
      dateSeparator: "/",
    });

    expect(normalizeField({ label: "Role", type: "unsupported", autofillSource: "role" })).toMatchObject({
      id: "",
      name: "Role",
      type: "text",
      prefillMode: "auto",
      autoExtract: "jobTitle",
    });
  });

  test("preserves an empty pre-fill source selection while editing", () => {
    expect(normalizeField({ name: "Source", prefillMode: "auto" })).toMatchObject({
      prefillMode: "auto",
      autoExtract: "",
      staticValue: "",
    });

    expect(normalizeField({ name: "Status", prefillMode: "static" })).toMatchObject({
      prefillMode: "static",
      autoExtract: "",
      staticValue: "",
    });
  });

  test("validates required destination and field names", () => {
    expect(validateConfig({ sheetId: "", tabName: "", fields: [] })).toEqual([
      "Sheet ID is required.",
      "Tab name is required.",
      "At least one field is required.",
    ]);

    expect(validateConfig({ sheetId: "sheet", tabName: "Sheet1", fields: [{ name: "" }] })).toEqual([
      "Field 1 needs a name.",
    ]);
  });

  test("slugifies labels and creates an id when there are no existing fields", () => {
    expect(slugify("  Job Title / Role!  ")).toBe("job-title-role");
    expect(makeUniqueId("job-title", 0)).toBe("job-title");
    expect(makeUniqueId("", 0)).toBe("field-1");
  });
});
