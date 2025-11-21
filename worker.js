// --- Worker Code: worker.js ---

// Note: ACCOUNT_ID, PROFILE_ID, and CLOUDFLARE_API_TOKEN must be set as 
// Environment Variables (Secrets) in the Cloudflare Worker settings.

const GOOGLE_IP_RANGES = [
  'https://www.gstatic.com/ipranges/cloud.json',
  'https://www.gstatic.com/ipranges/goog.json'
];

const API_BASE = 'https://api.cloudflare.com/client/v4';

// --- Worker Handler ---
export default {
  async scheduled(event, env, ctx) {
    console.log("Scheduled IPv4 sync initiated...");
    ctx.waitUntil(syncGoogleIPs(env));
  },
  async fetch(request, env, ctx) {
    ctx.waitUntil(syncGoogleIPs(env));
    return new Response('Cloudflare WARP Split-Tunnel IPv4 sync initiated. Check logs for status.', { status: 200 });
  }
};

/**
 * Main function to perform the sync operation.
 * @param {Object} env - The Workers environment variables (containing secrets).
 */
async function syncGoogleIPs(env) {
  const { ACCOUNT_ID, PROFILE_ID, CLOUDFLARE_API_TOKEN } = env;

  if (!ACCOUNT_ID || !PROFILE_ID || !CLOUDFLARE_API_TOKEN) {
    console.error("Missing required environment variables. Aborting sync.");
    return;
  }

  try {
    // 1. Fetch Google IP Ranges (IPv4 ONLY)
    const googleIPs = await fetchGoogleIPs();
    console.log(`Fetched ${googleIPs.length} unique Google IPv4 ranges.`);

    // 2. Fetch Current Cloudflare Include List
    const existingRoutes = await fetchCurrentRoutes(ACCOUNT_ID, PROFILE_ID, CLOUDFLARE_API_TOKEN);
    console.log(`Found ${existingRoutes.length} existing Split Tunnel routes.`);

    // 3. Determine New Routes to Add
    // Ensure we only look at addresses, not descriptions, for comparison
    const existingCIDRs = new Set(existingRoutes.map(route => route.address));
    const routesToAdd = [];

    for (const cidr of googleIPs) {
      if (!existingCIDRs.has(cidr)) {
        routesToAdd.push({
          address: cidr,
          description: 'Google IPv4 Range (Auto-synced)'
        });
      }
    }

    if (routesToAdd.length === 0) {
      console.log('IPv4 Split Tunnel list is already in sync. No updates needed.');
      return;
    }

    // 4. Create the Complete New List (Existing + New)
    // NOTE: This PUT operation requires sending the FULL list (Existing + New)
    const newCompleteList = [...existingRoutes, ...routesToAdd];
    console.log(`Adding ${routesToAdd.length} new IPv4 routes. Total routes will be ${newCompleteList.length}.`);

    // 5. Update Cloudflare Split Tunnel Include List (Single PUT request)
    const updateSuccess = await updateSplitTunnelList(
      ACCOUNT_ID,
      PROFILE_ID,
      CLOUDFLARE_API_TOKEN,
      newCompleteList
    );

    if (updateSuccess) {
      console.log('Successfully updated the Split Tunnel Include List with IPv4 ranges.');
    } else {
      console.error('Failed to update the Split Tunnel Include List.');
    }

  } catch (error) {
    console.error('An error occurred during sync:', error.stack || error);
  }
}

/**
 * Fetches and aggregates only IPv4 CIDRs from the Google JSON files.
 * @returns {Promise<string[]>} An array of unique IPv4 CIDR strings.
 */
async function fetchGoogleIPs() {
  const allCIDRs = new Set();
  const fetchPromises = GOOGLE_IP_RANGES.map(url =>
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data.prefixes) {
          // *** MODIFIED: ONLY EXTRACT IPv4 CIDRs ***
          data.prefixes.forEach(p => {
            if (p.ipv4Prefix) {
              allCIDRs.add(p.ipv4Prefix);
            }
          });
        }
        // IPv6 prefixes (ipv6Prefixes) are ignored
      })
      .catch(error => {
        console.error(`Error fetching IP ranges from ${url}:`, error);
      })
  );

  await Promise.all(fetchPromises);
  return Array.from(allCIDRs);
}

/**
 * Fetches the current split-tunnel include list from the device profile.
 * (No change needed)
 */
async function fetchCurrentRoutes(accountId, profileId, apiToken) {
  const url = `${API_BASE}/accounts/${accountId}/devices/policy/${profileId}/include`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch current routes. Status: ${response.status}. Response: ${error}`);
  }

  const result = await response.json();
  // Ensure that the routes retrieved from the API are still valid, even if 
  // they include IPv6 ranges that we won't add back from the source list.
  return result.result || [];
}

/**
 * Updates the split-tunnel include list with the complete new list.
 * (No change needed - PUT requires the full list)
 */
async function updateSplitTunnelList(accountId, profileId, apiToken, completeList) {
  const url = `${API_BASE}/accounts/${accountId}/devices/policy/${profileId}/include`;
  console.log(`Sending PUT request with ${completeList.length} total entries.`);
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(completeList) 
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Update failed. Status: ${response.status}. Response: ${error}`);
    return false;
  }

  const result = await response.json();
  return result.success;
}