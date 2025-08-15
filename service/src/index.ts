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

/**
 * Acquires an access token using the client credentials flow and calls the Graph API.
 */
export async function fetchUsersFromGraph() {
  try {
    // Specify the scopes for the permissions you need
    const clientCredentialRequest = {
      // need to grant the app (client ID) the following API permissions: User.Read.All, Group.Read.All.  also, Grant admin consent for the permissions 
      scopes: ['https://graph.microsoft.com/.default'],
    };

    console.log('✅ Acquiring token via client credentials flow...');

    // Acquire the token silently first (if cached), then via request if needed
    const response = await msalClient.acquireTokenByClientCredential(clientCredentialRequest);

    if (!response || !response.accessToken) {
      throw new Error('Failed to acquire a token from Entra ID.');
    }

    console.log('✅ Successfully acquired access token.', response.accessToken);

    // Use the access token to call the Microsoft Graph API
    const usersEndpoint = 'https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName';
    const apiResponse = await fetch(usersEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${response.accessToken}`,
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

// Example usage
(async () => {
  await fetchUsersFromGraph();
})();