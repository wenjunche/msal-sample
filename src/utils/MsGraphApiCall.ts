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
    Domains?: string[];
};

type ServiceUser = {
    username: string;
    displayName: string;
    givenName: string;
    surname: string;
}

type ServiceGroup = {
    displayName: string;
    members: ServiceUser[];
}

export type ServicePrincipal = {
    appId: string;
    displayName: string;
    customSecurityAttributes: EBCustomSecurityAttributes;
    users: ServiceUser[];
    groups: ServiceGroup[];
    url: string;
    loginUrl?: string; // Optional, fir Linked apps in Entra
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
        const groups: ServicePrincipal["groups"] = [];
        await getServicePrincipalAssignments(sp.id, users, groups);
        principals.push({
            appId: sp.appId,
            displayName: sp.displayName,
            customSecurityAttributes: sp.customSecurityAttributes[HereAttributeSet],
            users,
            groups,
            url: sp.url,
        });
    }
    console.log('Service Principals with users', principals);
    return principals;
}

async function getServicePrincipalAssignments(id: string, users: ServicePrincipal["users"], groups: ServicePrincipal["groups"] = []) {
    const url = new URL(graphConfig.graphServicePrincipalAssignments.replace("{id}", id));
    const resp = await callMsGraph(url.toString());
    console.log('Service Principal Assignments', resp.value);
    for (const assignment of resp.value) {
        const principalId = assignment.principalId;
        if (assignment.principalType === "User") {
            const user = await getServiceUserByPrincipalId(principalId);
            // @TODO: how to handle users if not exist in EB ?
            users.push({
                username: user.userPrincipalName,
                displayName: user.displayName,
                givenName: user.givenName,
                surname: user.surname,
            });
        } else if (assignment.principalType === "Group") {
            const group = await getServiceGroupByPrincipalId(principalId);
            const members = await getServiceGroupMembersByPrincipalId(principalId);
            const groupMembers: ServiceUser[] = members.value.map((member: any) => ({
                username: member.userPrincipalName,
                displayName: member.displayName,
                givenName: member.givenName,
                surname: member.surname,
            }));
            groups.push({
                displayName: group.displayName,
                members: groupMembers,
            });
            // @TODO: how to handle groups and group members if not exist in EB ?
        }   
    }
}

async function getServiceUserByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphUserByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph(url.toString());
    console.log('Service User', resp);
    return resp;
}

async function getServiceGroupByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphGroupByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph(url.toString());
    console.log('Service Group', resp);
    return resp;
}

async function getServiceGroupMembersByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphGroupMembersByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph(url.toString());
    console.log('Service Group', resp);
    return resp;
}

export async function syncApplications(principals: ServicePrincipal[]): Promise<void> {
    const users = await getAllUsers();
    const existingApps = await getAllApps();

    for (const principal of principals) {
        if (principal.customSecurityAttributes && principal.customSecurityAttributes.EBEnabled) {
            const existingApp = existingApps.find((app) => app.contentId === principal.appId);
            if (existingApp) {
                console.log(`Application already exists: ${principal.displayName} (${principal.appId})`);
                continue; // Skip if the app already exists
            }
            console.log(`Syncing application: ${principal.displayName} (${principal.appId})`);
            const app = mapServicePrincipalToApp(principal, users);
            console.log(`Creating app with payload:`, app);
            await createApp(app);
        } else {
            console.log(`Skipping application: ${principal.displayName} (${principal.appId}) - EBEnabled is false`);
        }
    };
    console.log("Application sync completed.");
}

