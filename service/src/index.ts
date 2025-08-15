// msal-graph-client.ts
import { ConfidentialClientApplication, Configuration } from '@azure/msal-node';
import fetch from 'node-fetch';

import * as dotenv from 'dotenv';
dotenv.config();

// Load your credentials from environment variables (recommended)
const config = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID || 'YOUR_AZURE_CLIENT_ID',
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'YOUR_AZURE_TENANT_ID'}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET || 'YOUR_AZURE_CLIENT_SECRET',
  },
} as Configuration;

// Create an MSAL client instance
const msalClient = new ConfidentialClientApplication(config);

type GraphUser = {
    id: string;
    displayName: string;
    userPrincipalName: string;
};
type GraphResponse<T> = {
  '@odata.context': string;
  value: T[];
};

async function fetchAccessToken() {
  const clientCredentialRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };

  console.log('✅ Acquiring token via client credentials flow...');

  const response = await msalClient.acquireTokenByClientCredential(clientCredentialRequest);

  if (!response || !response.accessToken) {
    throw new Error('Failed to acquire a token from Entra ID.');
  }

  console.log('✅ Successfully acquired access token.', response.accessToken);
  return response.accessToken;
};

/**
 * Acquires an access token using the client credentials flow and calls the Graph API.
 */
export async function fetchUsersFromGraph(accessToken: string) {
  try {
    // Use the access token to call the Microsoft Graph API
    const usersEndpoint = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName';
    const apiResponse = await fetch(usersEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`Graph API call failed with status: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const userData = await apiResponse.json() as GraphResponse<GraphUser>;
    console.log(`Successfully fetched ${userData.value.length} users from Graph.`);

    // In a real microservice, you would process this data now.
    userData.value.forEach((user: any) => {
      console.log(`- User: ${user.displayName} (${user.userPrincipalName})`);
    });

  } catch (error) {
    console.error('❌ Error during Graph API call:', error);
  }
}

/**
 * Acquires an access token using the client credentials flow and calls the Graph API.
 */
export async function fetchGroupsFromGraph(accessToken: string) {
  try {
    // Use the access token to call the Microsoft Graph API
    const groupsEndpoint = 'https://graph.microsoft.com/v1.0/groups?$select=id,displayName';
    const apiResponse = await fetch(groupsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`Graph API call failed with status: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const groupData = await apiResponse.json() as GraphResponse<GraphUser>;
    console.log(`Successfully fetched ${groupData.value.length} users from Graph.`);

    // In a real microservice, you would process this data now.
    groupData.value.forEach((group: any) => {
      console.log(`- Group: ${group.displayName} (${group.id})`);
    });

  } catch (error) {
    console.error('❌ Error during Graph API call:', error);
  }
}


// Example usage
(async () => {
  const accessToken = await fetchAccessToken();
  await fetchUsersFromGraph(accessToken);
  await fetchGroupsFromGraph(accessToken);
})();