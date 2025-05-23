import { Configuration, PopupRequest } from "@azure/msal-browser";

// Config object to be passed to Msal on creation
export const msalConfig: Configuration = {
    auth: {
        clientId: "1ade5620-60da-450b-8100-e5ac80db97e8",
        authority: "https://login.microsoftonline.com/051d23bf-9257-4c0c-b503-512ae19844dc",
        redirectUri: "http://localhost:3000",
        postLogoutRedirectUri: "/",
    },
    system: {
        allowPlatformBroker: false, // Disables WAM Broker
    },
};

// Add here scopes for id token to be used at MS Identity Platform endpoints.
export const loginRequest: PopupRequest = {
    scopes: ["User.Read", "Directory.Read.All", "Application.Read.All", "CustomSecAttributeAssignment.Read.All"],
};

// Add here the endpoints for MS Graph API services you would like to use.
export const graphConfig = {
    graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
    graphOrgEndpoint: "https://graph.microsoft.com/v1.0/organization",
    graphServicePrincipalsEndpoint: "https://graph.microsoft.com/v1.0/servicePrincipals",
    graphServicePrincipalAssignments: "https://graph.microsoft.com/v1.0/servicePrincipals/{id}/appRoleAssignedTo",
    graphUserByIdEndpoint: "https://graph.microsoft.com/v1.0/users/{id}",
};
