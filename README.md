# ☁️ Cloudflare WARP Split-Tunnel Auto-Sync

An automatic synchronization tool deployed as a **Cloudflare Worker** to keep your WARP Split-Tunnel **Include** list updated with the latest Google and Cloudflare IP ranges. This ensures your Zero Trust policy can securely proxy or inspect traffic to these critical services without interruption.

## 🚀 Deployment Instructions

This Worker is deployed using the **Cloudflare Dashboard's "Deploy with Git"** feature, which links your Cloudflare Worker to this GitHub repository for automatic updates.

### 1. Create the Repository from Template

Start by creating a new repository from this template:

1.  Click the **"Use this template"** button at the top of this GitHub page.
2.  Choose a name for your new repository (e.g., `warp-sync-worker`).
3.  Click **"Create repository from template"**.

### 2. Connect and Deploy via Cloudflare Dashboard

1.  Log into your **Cloudflare Dashboard**.
2.  Navigate to **Workers & Pages**.
3.  Click **"Create application"**.
4.  Select the **"Connect to Git"** tab.
5.  Click **"Connect GitHub"** and authorize Cloudflare to access your repository.
6.  Select the repository you created in Step 1 (e.g., `warp-sync-worker`).
7.  In the **Build and deployment settings**, keep the default values (Wrangler is the default build system).
8.  Click **"Deploy"**. Cloudflare will clone your repository and deploy the worker.

### 3. Configure Worker Secrets (Environment Variables)

The Worker requires three sensitive pieces of information to authenticate with the Cloudflare API and know which profile to update. You must set these as **Secrets** (Encrypted Environment Variables).

1.  In your Cloudflare dashboard, navigate to your newly deployed Worker.
2.  Go to the **Settings** tab.
3.  Scroll to the **Variables** section.

Add the following three variables as **Secrets** (use the **"Encrypt"** toggle):

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `ACCOUNT_ID` | Your Cloudflare Account ID | Found on the Cloudflare dashboard homepage. |
| `PROFILE_ID` | Your Device Profile ID | The **UUID** of the WARP Profile you want to update (found in the Zero Trust dashboard URL when editing the profile). |
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API Token | **Must have:** `Zero Trust` $\rightarrow$ `Edit` permission. |

### 4. Set Up the Cron Trigger (Scheduled Execution)

The Worker must run periodically to check for IP address changes.

1.  In your deployed Worker's dashboard, go to the **Triggers** tab.
2.  Under **Cron Triggers**, click **"Add Cron Trigger"**.
3.  Enter a schedule (e.g., `0 * * * *` to run every hour).
4.  Click **"Save"**.

---

## 🛠️ Worker Logic (`index.js`)

The Worker runs periodically and executes the following steps:

1.  **Fetch Google IPs:** Retrieves all current IPv4 and IPv6 CIDR ranges from `cloud.json` and `goog.json`.
2.  **Fetch Existing Routes:** Calls the Cloudflare Zero Trust API to get the **current list** of routes in the target WARP Split-Tunnel **Include** profile.
3.  **Compare and Filter:** Compares the fetched Google IPs against the existing list, identifying only the new, unique CIDRs that have not yet been added.
4.  **Update Profile:** Creates a complete, merged list (existing entries + new Google entries) and sends it back to the Cloudflare API via a `PUT` request. This operation **overwrites** the existing list with the synchronized, complete list.

### 🔑 API Token Permissions Required

The **Cloudflare API Token** (`CLOUDFLARE_API_TOKEN`) used in the Worker's Secrets must have the following permission to allow it to modify your Zero Trust policies:

* **Zero Trust $\rightarrow$ Edit:** `Edit`