// --- Configuration Variables (Use Worker Secrets for real-world deployment) ---

const ACCOUNT_ID = 'YOUR_CLOUDFLARE_ACCOUNT_ID'; // e.g., 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6'
const PROFILE_ID = 'YOUR_DEVICE_PROFILE_ID'; // e.g., '1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6'
const CLOUDFLARE_API_TOKEN = 'YOUR_CLOUDFLARE_API_TOKEN'; // Requires Zero Trust:Edit permission

const GOOGLE_IP_RANGES = [
  'https://www.gstatic.com/ipranges/cloud.json',
  'https://www.gstatic.com/ipranges/goog.json'
];

const API_BASE = 'https://api.cloudflare.com/client/v4';

// --- Worker Handler ---
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(syncGoogleIPs(env));
  },
  async fetch(request, env, ctx) {
    ctx.waitUntil(syncGoogleIPs(env));
    return new Response('Cloudflare WARP Split-Tunnel sync initiated.', { status: 200 });
  }
};

/**
 * Main function to perform the sync operation.
 * @param {Object} env - The Workers environment variables (containing secrets).
 */
async function syncGoogleIPs(env) {
  const { ACCOUNT_ID, PROFILE_ID, CLOUDFLARE_API_TOKEN } = env;

  try {
    // 1. Fetch Google IP Ranges
    const googleIPs = await fetchGoogleIPs();
    console.log(`Fetched ${googleIPs.length} Google IP ranges.`);

    // 2. Fetch Current Cloudflare Include List
    const existingRoutes = await fetchCurrentRoutes(ACCOUNT_ID, PROFILE_ID, CLOUDFLARE_API_TOKEN);
    console.log(`Found ${existingRoutes.length} existing Split Tunnel routes.`);

    // 3. Determine New Routes to Add
    const existingCIDRs = new Set(existingRoutes.map(route => route.address));
    const routesToAdd = [];

    for (const cidr of googleIPs) {
      if (!existingCIDRs.has(cidr)) {
        routesToAdd.push({
          address: cidr,
          description: 'Google Service Range (Auto-synced)'
        });
      }
    }

    if (routesToAdd.length === 0) {
      console.log('Split Tunnel list is already in sync. No updates needed.');
      return;
    }

    // 4. Create the Complete New List (Existing + New)
    const newCompleteList = [...existingRoutes, ...routesToAdd];
    console.log(`Adding ${routesToAdd.length} new routes. Total routes will be ${newCompleteList.length}.`);

    // 5. Update Cloudflare Split Tunnel Include List
    const updateSuccess = await updateSplitTunnelList(
      ACCOUNT_ID,
      PROFILE_ID,
      CLOUDFLARE_API_TOKEN,
      newCompleteList
    );

    if (updateSuccess) {
      console.log('Successfully updated the Split Tunnel Include List.');
    } else {
      console.error('Failed to update the Split Tunnel Include List.');
    }

  } catch (error) {
    console.error('An error occurred during sync:', error.stack || error);
    // You might want to add external logging here (e.g., Cloudflare Logpush)
  }
}

/**
 * Fetches and aggregates all IPv4 and IPv6 CIDRs from the Google JSON files.
 * @returns {Promise<string[]>} An array of unique CIDR strings.
 */
async function fetchGoogleIPs() {
  const allCIDRs = new Set();
  const fetchPromises = GOOGLE_IP_RANGES.map(url =>
    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data.prefixes) {
          // Extract IPv4 CIDRs
          data.prefixes.forEach(p => {
            if (p.ipv4Prefix) {
              allCIDRs.add(p.ipv4Prefix);
            }
          });
        }
        if (data && data.ipv6Prefixes) {
          // Extract IPv6 CIDRs
          data.ipv6Prefixes.forEach(p => {
            if (p.ipv6Prefix) {
              allCIDRs.add(p.ipv6Prefix);
            }
          });
        }
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
 * @returns {Promise<Array<{address: string, description: string}>>} The existing routes.
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

  // The 'result' object contains the list of routes
  return result.result || [];
}

/**
 * Updates the split-tunnel include list with the complete new list.
 * NOTE: This is a PUT operation and will OVERWRITE the current list.
 * @param {Array<{address: string, description: string}>} completeList - The full list of routes to set.
 * @returns {Promise<boolean>} True if the update was successful.
 */
async function updateSplitTunnelList(accountId, profileId, apiToken, completeList) {
  const url = `${API_BASE}/accounts/${accountId}/devices/policy/${profileId}/include`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(completeList) // The body is the array of routes
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Update failed. Status: ${response.status}. Response: ${error}`);
    return false;
  }

  const result = await response.json();
  return result.success;
}