# ☁️ warp-google-ip-sync: Cloudflare WARP Split-Tunnel Auto-Sync

This project deploys a **Cloudflare Worker** designed to automatically synchronize your WARP Split-Tunnel **Include List** with the latest official IPv4 address ranges used by Google services.

By keeping this list current, you ensure your Zero Trust policies can accurately and reliably inspect or proxy traffic destined for these critical services without interruption.

---

## 💻 Application Logic: The Synchronization Workflow

The Worker runs periodically (via a Cron Trigger) and executes a four-step process to ensure the WARP profile remains perfectly synchronized. **Note: This script targets IPv4 addresses only.** 

### 1. Data Collection (GET External IPs)

The Worker initiates HTTP **GET** requests to fetch the most current **IPv4** ranges used by Google:

* `https://www.gstatic.com/ipranges/cloud.json`
* `https://www.gstatic.com/ipranges/goog.json`

It parses the responses, extracting and aggregating all unique IPv4 CIDR ranges into a single source list.

### 2. Current Profile Retrieval (GET API Data)

The Worker authenticates using the `CLOUDFLARE_API_TOKEN` and performs a **GET** request to the Cloudflare Zero Trust API, targeting the specified Split-Tunnel **Include** list using the provided `ACCOUNT_ID` and `PROFILE_ID`.

* **Objective:** To download the **entire list** of IP ranges currently configured in the WARP profile.

### 3. Comparison and Deduplication

The script compares the fetched IPv4 ranges against the existing list from the API.

* It identifies and isolates **only the new IPv4 CIDR ranges** that have appeared in the Google source since the last run.
* This ensures that the existing list is preserved and only necessary updates are processed.

### 4. Synchronization and Update (PUT API Data)

The Worker builds the complete, new list by combining:

* The **Existing IP ranges** from the WARP profile.
* The **New, unique Google IPv4 ranges** identified in Step 3.

This complete, merged list is then sent to the Cloudflare API via a single **PUT** request. **This PUT operation completely overwrites the existing Split-Tunnel Include list** with the new, fully synchronized list.

---

## 🚀 Detailed Deployment Steps

Follow these steps to deploy the Worker by linking your forked GitHub repository to Cloudflare.

### Prerequisites

1.  A **Cloudflare Account**.
2.  A **Cloudflare API Token** with the **Zero Trust $\rightarrow$ Edit** permission.

### Step 1: Fork and Prepare the Repository

1.  **Fork** this repository to your personal GitHub account.
2.  Ensure the following two files are in the root of your forked repository:
    * **`worker.js`**: (Contains the synchronization script)
    * **`wrangler.toml`**: (The configuration file defining the worker name)

### Step 2: Create Application and Connect GitHub

1.  Log into your **Cloudflare Dashboard**.
2.  Click on **"Compute & AI"** in the sidebar.
3.  Click **"Workers & Pages"**.
4.  Click **"Create application"**.
5.  On the **Workers & Pages** page, select the **"Continue with GitHub"** button.
6.  Sign in with your GitHub account and authorize Cloudflare.
7.  Select the repository you just **forked** (`warp-google-ip-sync` or similar) from the list.
8.  Click **"Begin setup"**.
9.  Review the settings (default settings are correct for a Worker).
10. Click **"Deploy"**. Cloudflare will deploy the worker under the name specified in `wrangler.toml`.

### Step 3: Configure Worker Secrets (Environment Variables)

The Worker requires three variables to execute the API calls successfully. You must set these as **Secrets** (Encrypted Environment Variables) in the Cloudflare Dashboard.

1.  In the Cloudflare Dashboard, navigate to your deployed Worker (`warp-google-ip-sync`).
2.  Go to the **Settings** tab.
3.  Scroll to the **Variables** section and add the following three variables as **Secrets** (use the **"Encrypt"** toggle):

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| **`ACCOUNT_ID`** | Your Cloudflare Account ID | Found on the Cloudflare dashboard homepage. |
| **`PROFILE_ID`** | Your Device Profile ID (UUID) | Found in the Zero Trust dashboard URL when editing the specific WARP profile. |
| **`CLOUDFLARE_API_TOKEN`** | Your Cloudflare API Token | **Must have Zero Trust $\rightarrow$ Edit** permission. |

### Step 4: Set Up the Cron Trigger (Scheduled Execution)

To ensure synchronization is continuous, set up a scheduled execution.

1.  In your deployed Worker's dashboard, go to the **Triggers** tab.
2.  Under **Cron Triggers**, click **"Add Cron Trigger"**.
3.  Enter a schedule (e.g., `0 * * * *` to run once every hour).
4.  Click **"Save"**.

The Worker is now fully deployed and scheduled to automatically synchronize your WARP Split-Tunnel Include list.
