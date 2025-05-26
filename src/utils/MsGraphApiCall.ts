import { loginRequest, graphConfig } from "../authConfig";
import { msalInstance } from "../index";

export async function callMeGraph() {
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

const HereAttributeSet = 'WCustomAttr1';
const HereEnableAttribute = 'EBEnabled';

type EBCustomSecurityAttributes = {
    EBEnabled: boolean;
};

export type ServicePrincipal = {
    appId: string;
    displayName: string;
    customSecurityAttributes: EBCustomSecurityAttributes;
    users: {
        username: string;
        displayName: string;
    }[];
    url?: string;
};

export async function callServicePrincipalGraph(): Promise<ServicePrincipal[]> {
    const tenantId = await getTenantId();
    const principals = await searchServicePrincipals();
    principals.forEach((sp) => {
        sp.url = `https://launcher.myapps.microsoft.com/api/signin/${sp.appId}?tenantId=${tenantId}`;
    });
    console.log('Service Principals with URLs', principals);
    return principals;
}

async function getTenantId(): Promise<string | undefined> {
    const resp = await callMsGraph(graphConfig.graphOrgEndpoint);
    const tenantId = resp.value[0]?.id;
    console.log('Tenant ID', tenantId);
    return tenantId;
}

async function searchServicePrincipals(): Promise<ServicePrincipal[]> {
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
            users,
            url: sp.url,
        });
    }
    console.log('Service Principals with users', principals);
    return principals;
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

