# Job Fill Auto Extension

Chrome extension that appends a row to your Google Sheet when you submit job details from the popup. Supports the following job boards:

- Ashby
- Greenhouse
- Lever
- Workday
- Linkedin

## Why

Job applications are spread out all over different job boards. All job boards track the jobs that you've applied to on their platforms making it harder to track all jobs across different platforms. Google sheets acts as a ground truth where you can fill in your details pretty easily, but it gets pretty exhausting having to copy and paste the same details 20 times a day, every day. This extension aims to automate the copy-pasting part by automatically adding these fields from the browser to your selected google sheet, making one aspect of the job search a little easier.

## Note

This extension is currently a work in progress and is meant to be run as an unpacked Chrome extension in developer/debug mode. You should be comfortable creating a Google Cloud OAuth client and editing `manifest.json`. It also supports a rigid sheet structure currently, so your Google Sheet should have the fields given below in the mentioned order. 

## Google Sheet layout

The extension appends **one row** with **14 columns** (in order). Your sheet’s **header row** should match this so columns line up.


| Column | Header (suggested)     | Filled by extension     |
| ------ | ---------------------- | ----------------------- |
| A      | Job link               | Yes — current tab URL * |
| B      | Organization           | Yes *                   |
| C      | Role                   | Yes *                   |
| D      | Date                   | Yes — `DD/MM/YYYY`*     |
| E      | Company URL            | No — left empty         |
| F      | Status                 | Yes — set to `Applied`  |
| G      | Recruiter 1            | No — left empty         |
| H      | Recruiter 2            | No — left empty         |
| I      | Recruiter 3            | No — left empty         |
| J      | Recruiter 4            | No — left empty         |
| K      | Recruiter 5            | No — left empty         |
| L      | Additional recruiters  | No — left empty         |
| M      | Recruiter email status | No — left empty         |
| N      | Notes                  | No — left empty         |


**Example header row (row 1):**  
`Job link | Organization | Role | Date | Company URL | Status | Recruiter 1 | Recruiter 2 | Recruiter 3 | Recruiter 4 | Recruiter 5 | Additional recruiters | Recruiter email status | Notes`

The tab you use in the extension must exist and should have this structure (at least columns A–N in row 1 for clarity).

## Setup

### 1. Load the extension in debug mode

1. Open Chrome → `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository folder.
5. Keep this page open and copy the generated extension **ID**. You will use it when creating the Google OAuth client.

### 2. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (e.g. “Job Fill Extension”).
3. **APIs & Services → Library** → enable **Google Sheets API**.
4. **APIs & Services → OAuth consent screen** → type **External** → add app name, your email, and scope `https://www.googleapis.com/auth/spreadsheets`.
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
  - Application type: **Chrome extension** (or **Chrome app**, depending on what the console offers for extensions).
  - **Item ID** / **Application ID**: paste the extension **ID** from step 1.
6. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).

### 3. Configure `manifest.json`

Chrome requires the OAuth client ID directly in the extension manifest. In `manifest.json`, replace the `oauth2.client_id` value with your own Google OAuth client ID:

```json
"client_id": "<YOUR_GOOGLE_OAUTH_CLIENT_ID>"
```

After saving `manifest.json`, go back to `chrome://extensions` and click **Reload** on the extension card. If you change the OAuth client or extension files later, reload the extension from this page again.

### 4. Use the extension

1. Open your sheet and note the **Sheet ID** from the URL:
  `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
2. Open the extension popup → **Sheet settings** → paste **Sheet ID** and the exact **tab name** (e.g. `Sheet1`).
3. On a job posting page, open the popup, confirm or edit fields, then **Submit to Sheets**.

## Tasks to-do:
- [ ] Fix all auto-fill fields (job title, company name, salary comp on all job board sites)
    - [x] Fix company name on Ashby, Greenhouse, Lever, Workday
    - [ ] Detect salary comp
    - [ ] Add location field (auto-detection) to job fields
- [ ] Screen to add configuration options
    - [ ] Users can set their own columns to auto detect and enter
    - [ ] Users should be able to select the mandatory columns, and click (see more...) to expand the modal to add entries in optional columns
- [ ] Make extension sticky (open once, close only on close button)
- [ ] Linkedin job link needs to click the "Copy Link" button to copy the job link
- [ ] Remove query params
- [ ] Add option to sign in with google (social login) to auto detect sheets and names
    - [ ] Removes the need to have a unique key so that everyone can login easily
- [ ] Publish extension to google extension store