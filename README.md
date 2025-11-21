# ☁️ Cloudflare WARP Split-Tunnel Auto-Sync

An automatic synchronization tool deployed as a **Cloudflare Worker** to keep your WARP Split-Tunnel **Include** list updated with the latest Google and Cloudflare IP ranges. This ensures your Zero Trust policy can securely proxy or inspect traffic to these critical services without interruption.

## 🚀 Deployment Instructions

**(Same as previous instructions: 1. Create Repository, 2. Connect and Deploy via Cloudflare Dashboard, 3. Configure Worker Secrets, 4. Set Up the Cron Trigger)**

---

## 💻 Application Logic: The Synchronization Workflow

The primary goal of this Worker is to ensure the Split-Tunnel **Include List** of your WARP Device Profile is an exact, synchronized replica of the current Google and Cloudflare IP service ranges. The entire process runs on a schedule (Cron Trigger) and consists of four crucial steps:

### 1. Data Collection (GET External IPs)

The Worker initiates two HTTP **GET** requests to fetch the most current IP ranges used by Google for its services:

* `https://www.gstatic.com/ipranges/cloud.json`
* `https://www.gstatic.com/ipranges/goog.json`

The script parses both JSON responses and aggregates all unique **IPv4** and **IPv6 CIDR ranges** into a single master list.

### 2. Current Profile Retrieval (GET API Data)

The Worker authenticates using the `CLOUDFLARE_API_TOKEN` and performs a **GET** request to the Cloudflare Zero Trust API, targeting the specific Split-Tunnel **Include** list endpoint using the provided `ACCOUNT_ID` and `PROFILE_ID`.

* **Objective:** To download the **entire list** of IP ranges currently configured in the WARP profile.

### 3. Comparison and Deduplication

The script then performs a comparison to maintain the integrity of the list and ensure efficiency:

* It checks every IP range from the Google source list against the ranges retrieved from the existing WARP profile.
* It identifies and isolates **only the new CIDR ranges** that have appeared in the Google source since the last run. Ranges that are already present are ignored.

### 4. Synchronization and Update (PUT API Data)

Finally, the Worker builds the complete, new list by combining:

* The **Existing IP ranges** from the WARP profile.
* The **New, unique Google IP ranges** identified in Step 3.

This complete, merged list is then sent to the Cloudflare API via a **PUT** request. **This step is critical:** the `PUT` operation **overwrites** the existing Split-Tunnel Include list with the new, fully synchronized list. 

---

## 🔑 Permissions Required

The **Cloudflare API Token** (`CLOUDFLARE_API_TOKEN`) used in the Worker's Secrets must have the following permission:

* **Zero Trust $\rightarrow$ Edit:** `Edit`