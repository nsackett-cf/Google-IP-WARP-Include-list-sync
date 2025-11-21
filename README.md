# ☁️ Cloudflare WARP Split-Tunnel Auto-Sync

An automatic synchronization tool deployed as a **Cloudflare Worker** to keep your WARP Split-Tunnel **Include** list updated with the latest Google and Cloudflare IP ranges. This ensures your Zero Trust policy can securely proxy or inspect traffic to these critical services without interruption.

## 🚀 Deployment Instructions

This repository is designed to be deployed directly to Cloudflare Workers using the official **Cloudflare Worker GitHub Template** and GitHub Actions.

### 1. Create the Repository

Start by creating a new repository from this template:

1.  Click the **"Use this template"** button at the top of this GitHub page.
2.  Choose a name for your new repository (e.g., `warp-sync-worker`).
3.  Click **"Create repository from template"**.

### 2. Configure Cloudflare Credentials

The GitHub Action needs your Cloudflare credentials to deploy the Worker.

1.  Go to **Settings** in your new repository.
2.  Navigate to **Security** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
3.  Click the **"New repository secret"** button and add the following two secrets:

| Secret Name | Value | Description |
| :--- | :--- | :--- |
| `CF_ACCOUNT_ID` | Your Cloudflare Account ID | Found on the Cloudflare dashboard homepage. |
| `CF_API_TOKEN` | Your Cloudflare API Token | **Must have:** `Account` -> `Workers Scripts` -> `Edit` and `Zero Trust` -> `Edit` permissions. |

### 3. Customize Worker Environment Variables

The Worker needs specific IDs to know which WARP profile to update. These should be configured as **Worker Environment Variables** (not GitHub Secrets) to be accessed by the running Worker.

1.  Go to the **Cloudflare Dashboard** and navigate to your deployed Worker (named after your repository).
2.  Go to the **Settings** tab.
3.  Under the **Environment Variables** section, click **"Add variable"** and add the following:

| Variable Name | Value | Description |
| :--- | :--- | :--- |
| `ACCOUNT_ID` | Your Cloudflare Account ID | *(Same as the GitHub Secret, but needed by the Worker)* |
| `PROFILE_ID` | Your Device Profile ID | The UUID of the WARP Profile you want to update (found in the Zero Trust dashboard URL when editing the profile). |
| `CLOUDFLARE_API_TOKEN` | The Cloudflare API Token | *(Same as the GitHub Secret, but needed by the Worker)* |

### 4. Set Up the Cron Trigger

The Worker is designed to run periodically using a Cloudflare **Cron Trigger** to ensure the IP list stays current.

1.  In your deployed Worker's dashboard, go to the **Triggers** tab.
2.  Under **Cron Triggers**, click **"Add Cron Trigger"**.
3.  Enter a schedule (e.g., `0 * * * *` to run every hour).
4.  Click **"Save"**.

---

## 🛠️ Worker Logic (`index.js`)

The Worker executes the following steps on every scheduled run:

1.  **Fetch Google IPs:** Retrieves all current IPv4 and IPv6 CIDR ranges from:
    * `https://www.gstatic.com/ipranges/cloud.json`
    * `https://www.gstatic.com/ipranges/goog.json`
2.  **Fetch Existing Routes:** Calls the Cloudflare Zero Trust API to get the current list of entries in the target WARP Split-Tunnel **Include** profile.
3.  **Compare and Filter:** Compares the fetched Google IPs against the existing list, identifying only the new CIDRs that have not yet been added.
4.  **Update Profile:** Creates a complete, merged list (existing entries + new Google entries) and sends it back to the Cloudflare API via a `PUT` request. This operation **overwrites** the existing list with the synchronized, complete list.

### Worker Code Snippet (Core Logic)

```javascript
// Function to determine new routes and update the list (simplified view)
async function syncGoogleIPs(env) {
    // ... (fetch Google IPs and existing routes)

    const existingCIDRs = new Set(existingRoutes.map(route => route.address));
    const routesToAdd = [];

    // Only add IPs that aren't already present
    for (const cidr of googleIPs) {
        if (!existingCIDRs.has(cidr)) {
            routesToAdd.push({
                address: cidr,
                description: 'Google Service Range (Auto-synced)'
            });
        }
    }

    // If there are new entries, merge and push the complete list
    if (routesToAdd.length > 0) {
        const newCompleteList = [...existingRoutes, ...routesToAdd];
        await updateSplitTunnelList(env.ACCOUNT_ID, env.PROFILE_ID, env.CLOUDFLARE_API_TOKEN, newCompleteList);
    }
}