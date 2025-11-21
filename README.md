# ☁️ warp-google-ip-sync: Cloudflare WARP Split-Tunnel Auto-Sync

This project deploys a **Cloudflare Worker** designed to automatically synchronize your WARP Split-Tunnel **Include List** with the latest official IPv4 address ranges used by Google and Cloudflare services.

By keeping this list current, you ensure your Zero Trust policies can accurately and reliably inspect or proxy traffic destined for these critical services.

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

Follow these steps to deploy the Worker by connecting your GitHub repository to Cloudflare.

### Prerequisites

1.  A **GitHub Repository** created from this project's template.
2.  A **Cloudflare Account**.
3.  A **Cloudflare API Token** with the **Zero Trust $\rightarrow$ Edit** permission.

### Step 1: Push Configuration Files

Ensure the following two files are in the root of your GitHub repository and committed:

1.  **`worker.js`**: (Your worker script file)
2.  **`wrangler.toml`**: (The configuration file)

```toml
# wrangler.toml content for reference
name = "warp-google-ip-sync"
main = "worker.js"
compatibility_date = "2024-01-01"
# ... (rest of the file)