chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "extractData") {
    sendResponse(extractJobInfo());
  }
});

function extractJobInfo() {
  const result = {
    role: "",
    organization: "",
    salary: "",
    location: "",
  };

  const host = window.location.hostname.toLowerCase();

  if (host.includes("lever.co")) {
    extractLever(result);
  } else if (
    host.includes("greenhouse.io") ||
    host.includes("greenhouse.com")
  ) {
    extractGreenhouse(result);
  } else if (host.includes("linkedin.com")) {
    extractLinkedIn(result);
  } else if (host.includes("ashbyhq.com")) {
    extractAshby(result);
  } else if (
    host.includes("myworkdayjobs.com") ||
    host.includes("workdayjobs.com")
  ) {
    extractWorkday(result);
  }

  if (!result.role && !result.organization) {
    applyBasicFallback(result);
  }

  cleanResult(result);

  return result;
}

function extractLever(result) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const titleText = (ogTitle?.content || document.title).trim();
  if (!titleText.includes(" - ")) {
    return;
  }
  const [organization, ...roleParts] = titleText.split(" - ");
  result.organization = organization.trim();
  result.role = roleParts.join(" - ").trim();
}

function extractGreenhouse(result) {
  const titlePrefix = "Job Application for ";
  const titleText = document.title.trim();
  const ogDescription = document.querySelector(
    'meta[property="og:description"]',
  );
  if (ogDescription?.content) {
    result.location = ogDescription.content.trim();
  }

  if (!titleText.startsWith(titlePrefix) || !titleText.includes(" at ")) {
    // use fallback parsing instead
    return;
  }

  const [role, organization] = titleText.replace(titlePrefix, "").split(" at ");
  result.role = role.trim();
  result.organization = organization.trim();
}

function extractLinkedIn(result) {
  const job = document.querySelector(
    ".job-details-jobs-unified-top-card__job-title",
  );
  const organization = document.querySelector(
    ".job-details-jobs-unified-top-card__company-name",
  );
  const location = document.querySelector(
    ".job-details-jobs-unified-top-card__primary-description-container",
  );

  if (job) result.role = job.innerText.trim();
  if (organization) result.organization = organization.innerText.trim();
  if (location) result.location = location.innerText.split("·")[0].trim();
}

function extractAshby(result) {
  const metaTitle = (
    document.querySelector('meta[name="title"]')?.content || ""
  ).split("@");
  const job = metaTitle[0];
  const organization = metaTitle[1];

  if (job) result.role = job.trim();
  if (organization) {
    result.organization = organization.trim();
  }
}

function extractWorkday(result) {
  const tenant = window.location.hostname.split(".")[0];
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const metaTitle = document.querySelector('meta[name="title"]');
  const titleText = decodeHtmlEntities(
    (ogTitle?.content || metaTitle?.content || document.title || "").trim(),
  );
  if (tenant) {
    result.organization = tenant.charAt(0).toUpperCase() + tenant.slice(1);
  }
  if (titleText) {
    result.role = titleText;
  }
}

function applyBasicFallback(result) {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const metaTitle = document.querySelector('meta[name="title"]');
  const titleText = ogTitle
    ? ogTitle.content
    : metaTitle
      ? metaTitle.content
      : document.title;

  if (titleText.includes(" - ")) {
    const parts = titleText.split(" - ");
    result.role = parts[0].trim();
    result.organization = parts[1].trim();
  } else if (titleText.includes(" | ")) {
    const parts = titleText.split(" | ");
    result.role = parts[0].trim();
    result.organization = parts[1].trim();
  } else {
    result.role = titleText;
  }
}

function cleanResult(result) {
  result.role = decodeHtmlEntities(result.role);
  result.organization = decodeHtmlEntities(result.organization);
  result.salary = decodeHtmlEntities(result.salary);
  result.location = decodeHtmlEntities(result.location);

  const siteSuffixes = [
    " - LinkedIn",
    " Jobs",
    " Careers",
    " | Lever",
    " | Greenhouse",
    " | Ashby",
    " | Workday",
  ];
  siteSuffixes.forEach((suffix) => {
    result.role = result.role.replace(suffix, "").trim();
    result.organization = result.organization.replace(suffix, "").trim();
  });
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
