import { loginRequest, graphConfig } from "../authConfig";
import { msalInstance } from "../index";

export async function callMeGraph() {
    await getTenantId();
    await searchServicePrincipals();
    return callMsGraph(graphConfig.graphMeEndpoint);
}

async function callMsGraph(url: string, requestHeaders?: Headers) {
    const account = msalInstance.getActiveAccount();
    if (!account) {
        throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
    }

    const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account
    });

    const headers = new Headers();
    if (requestHeaders) {
        requestHeaders.forEach((value, key) => {
            headers.append(key, value);
        });
    }

    console.log("Access token: ", response.accessToken);
    const bearer = `Bearer ${response.accessToken}`;
    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers
    };

    return fetch(url, options)
        .then(response => {            
            return response.json().then(jsonResponse => {
                console.log(url, jsonResponse);
                return jsonResponse;
            }
            ).catch(error => {
                console.log("Error parsing JSON response: ", error);
                throw new Error("Error parsing JSON response");
            });  
        })
        .catch(error => console.log(error));
}

async function getTenantId() {
    const resp = await callMsGraph(graphConfig.graphOrgEndpoint);
    console.log('tenant ID', resp.value[0]?.id);
}

const HereAttributeSet = 'WCustomAttr1';
const HereEnableAttribute = 'EBEnabled';

type EBCustomSecurityAttributes = {
    EBEnabled: boolean;
};

type ServicePrincipal = {
    appId: string;
    displayName: string;
    customSecurityAttributes: EBCustomSecurityAttributes;
    users: {
        username: string;
        displayName: string;
    }[];
};

async function searchServicePrincipals() {
    const principals: ServicePrincipal[] = [];
    const url = new URL(graphConfig.graphServicePrincipalsEndpoint);
    url.searchParams.append("$filter", `customSecurityAttributes/${HereAttributeSet}/${HereEnableAttribute} eq true`);
    url.searchParams.append("$select", "id,appId,displayName,customSecurityAttributes");
    const headers = new Headers();
    headers.append("ConsistencyLevel", "eventual");
    const resp = await callMsGraph(url.toString(), headers);
    console.log('Service Principals', resp.value);
    for (const sp of resp.value) {
        const users: ServicePrincipal["users"] = [];
        await getServicePrincipalAssignments(sp.id, users);
        principals.push({
            appId: sp.appId,
            displayName: sp.displayName,
            customSecurityAttributes: sp.customSecurityAttributes[HereAttributeSet],
            users: [],
        });
    }
    console.log('Service Principals with users', principals);
}

async function getServicePrincipalAssignments(id: string, users: ServicePrincipal["users"]) {
    const url = new URL(graphConfig.graphServicePrincipalAssignments.replace("{id}", id));
    const resp = await callMsGraph(url.toString());
    console.log('Service Principal Assignments', resp.value);
    for (const assignment of resp.value) {
        const principalId = assignment.principalId;
        const user = await getServiceUserByPrincipalId(principalId);
        users.push({
            username: user.userPrincipalName,
            displayName: user.displayName,
        });
    }
}

async function getServiceUserByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphUserByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph(url.toString());
    console.log('Service User', resp);
    return resp;
}

