const {
  extractJobInfo,
  extractLever,
  extractGreenhouse,
  extractLinkedIn,
  extractAshby,
  extractWorkday,
  applyBasicFallback,
  cleanResult,
  decodeHtmlEntities,
} = require("../scripts/content");

function setUrl(url) {
  const parsed = new URL(url);
  delete window.location;
  window.location = parsed;
}

function addMeta(selectorName, selectorValue, content) {
  const meta = document.createElement("meta");
  meta.setAttribute(selectorName, selectorValue);
  meta.content = content;
  document.head.appendChild(meta);
  return meta;
}

describe("content extraction", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.title = "";
    setUrl("https://example.com/jobs/1");
  });

  test("extracts Lever organization and role from og:title", () => {
    setUrl("https://jobs.lever.co/acme/123");
    addMeta("property", "og:title", "Acme Corp - Senior Engineer");

    expect(extractJobInfo()).toEqual({
      role: "Senior Engineer",
      organization: "Acme Corp",
      salary: "",
      location: "",
    });
  });

  test("extracts Greenhouse role, organization, and location", () => {
    setUrl("https://boards.greenhouse.io/acme/jobs/123");
    document.title = "Job Application for Staff Engineer at Acme";
    addMeta("property", "og:description", "Remote - United States");

    expect(extractJobInfo()).toEqual({
      role: "Staff Engineer",
      organization: "Acme",
      salary: "",
      location: "Remote - United States",
    });
  });

  test("extracts LinkedIn values from known top-card selectors", () => {
    setUrl("https://www.linkedin.com/jobs/view/123");
    document.body.innerHTML = `
      <h1 class="job-details-jobs-unified-top-card__job-title">Product Engineer - LinkedIn</h1>
      <div class="job-details-jobs-unified-top-card__company-name">Example Jobs</div>
      <div class="job-details-jobs-unified-top-card__primary-description-container">New York · 2 days ago</div>
    `;
    document.querySelector(".job-details-jobs-unified-top-card__job-title").innerText = "Product Engineer - LinkedIn";
    document.querySelector(".job-details-jobs-unified-top-card__company-name").innerText = "Example Jobs";
    document.querySelector(".job-details-jobs-unified-top-card__primary-description-container").innerText =
      "New York · 2 days ago";

    expect(extractJobInfo()).toEqual({
      role: "Product Engineer",
      organization: "Example",
      salary: "",
      location: "New York",
    });
  });

  test("extracts Ashby values from meta title", () => {
    setUrl("https://jobs.ashbyhq.com/acme/123");
    addMeta("name", "title", "Engineering Manager @ Acme");

    expect(extractJobInfo()).toEqual({
      role: "Engineering Manager",
      organization: "Acme",
      salary: "",
      location: "",
    });
  });

  test("extracts Workday tenant and decodes title entities", () => {
    setUrl("https://acme.myworkdayjobs.com/careers/job/123");
    addMeta("property", "og:title", "R&amp;D Engineer");

    expect(extractJobInfo()).toEqual({
      role: "R&D Engineer",
      organization: "Acme",
      salary: "",
      location: "",
    });
  });

  test("falls back to generic title parsing when no board-specific extractor matches", () => {
    document.title = "Data Scientist | Example Careers";

    expect(extractJobInfo()).toEqual({
      role: "Data Scientist",
      organization: "Example",
      salary: "",
      location: "",
    });
  });

  test("individual helpers mutate and clean the provided result", () => {
    const result = { role: "", organization: "", salary: "", location: "" };
    document.title = "Role - Org";

    applyBasicFallback(result);
    cleanResult(result);

    expect(result).toEqual({ role: "Role", organization: "Org", salary: "", location: "" });
    expect(decodeHtmlEntities("A &amp; B")).toBe("A & B");
    expect(typeof extractLever).toBe("function");
    expect(typeof extractGreenhouse).toBe("function");
    expect(typeof extractLinkedIn).toBe("function");
    expect(typeof extractAshby).toBe("function");
    expect(typeof extractWorkday).toBe("function");
  });
});
