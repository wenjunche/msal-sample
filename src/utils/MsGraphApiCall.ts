import { loginRequest, graphConfig } from "../authConfig";
import { msalInstance } from "../index";

type GraphAPIRequest = {
    method?: string;
    url: string;
    headers?: Headers;
    payload?: unknown;
};

export async function callMeGraph() {
    return callMsGraph({url: graphConfig.graphMeEndpoint});
}

async function callMsGraph(request: GraphAPIRequest) {
    const account = msalInstance.getActiveAccount();
    if (!account) {
        throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
    }
    const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account
    });
    const headers = new Headers();
    if (request.payload) {
        headers.append("Content-Type", "application/json");
    }
    if (request.headers) {
        request.headers.forEach((value, key) => {
            headers.append(key, value);
        });
    }
//    console.log("Access token: ", response.accessToken);
    const bearer = `Bearer ${response.accessToken}`;
    headers.append("Authorization", bearer);
    const options = {
        method: request.method || 'GET',
        headers: headers,
        body: request.payload ? JSON.stringify(request.payload) : undefined,
    };
    return fetch(request.url, options)
        .then(response => {            
            return response.json().then(jsonResponse => {
                console.log(request.url, jsonResponse);
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

export type Application = {
    id?: string; // created by Entra
    appId?: string; // created by Entra
    displayName: string;
    tags?: string[];
};

export type ServicePrincipal = {
    id?: string; // created by Entra
    entraAppId?: string; // populated by Entra
    appId: string;
    displayName: string;
    customSecurityAttributes?: EBCustomSecurityAttributes;
    users?: ServiceUser[];
    groups?: ServiceGroup[];
    url: string;
    loginUrl?: string; // Optional, for Linked apps in Entra
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
    const resp = await callMsGraph({url: graphConfig.graphOrgEndpoint});
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
    const resp = await callMsGraph({url: url.toString(), headers: headers});
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
    const resp = await callMsGraph({url: url.toString()});
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
    const resp = await callMsGraph({url: url.toString()});
    console.log('Service User', resp);
    return resp;
}

async function getServiceGroupByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphGroupByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph({url: url.toString()});
    console.log('Service Group', resp);
    return resp;
}

async function getServiceGroupMembersByPrincipalId(principalId: string) {
    const url = new URL(graphConfig.graphGroupMembersByIdEndpoint.replace("{id}", principalId));
    const resp = await callMsGraph({url: url.toString()});
    console.log('Service Group', resp);
    return resp;
}

async function searchServicePrincipalsByUuid(uuid: string): Promise<ServicePrincipal | undefined> {
    console.log('Searching Service Principals by UUID:', uuid);
    const url = new URL(graphConfig.graphServicePrincipalsEndpoint);
    url.searchParams.append("$filter", `appId eq '${uuid}'`);
    url.searchParams.append("$select", "id,appId,displayName");
    const headers = new Headers();
    headers.append("ConsistencyLevel", "eventual");
    const resp = await callMsGraph({url: url.toString(), headers});
    console.log('Service Principals by UUID', resp.value);
    if (resp.value?.length === 1) {
        return {
            appId: resp.value[0].appId,
            displayName: resp.value[0].displayName,
            users: [],
            groups: [],
            url: "",
        }
    }
}

export async function syncApplicationsToEntra(principals: ServicePrincipal[]): Promise<void> {
    for (const principal of principals) {
        const existingApp = await searchServicePrincipalsByUuid(principal.appId);
        if (existingApp) {
            console.log(`Application already exists: ${principal.displayName} (${principal.appId})`);
            continue; // Skip if the app already exists
        }
        const app = await createApplication({
            displayName: principal.displayName,
            tags: [
                `EBUuid-${principal.appId}`,
            ],
        });
        if (!app) {
            console.error(`Failed to create application: ${principal.displayName} (${principal.appId})`);
            continue; // Skip if the app creation failed
        }
        principal.entraAppId = app.appId;
        const servicePrincipal = await createServicePrincipal(principal);
        if (!servicePrincipal) {
            console.error(`Failed to create service principal for application: ${principal.displayName} (${principal.appId})`);
            continue; // Skip if the service principal creation failed
        }
    };
    console.log("Application sync completed.");
}

async function createApplication(application: Application): Promise<Application | undefined> {
    console.log('Creating application', application);
    const url = new URL(graphConfig.graphServiceApplicationsEndpoint);
    const resp = await callMsGraph({url: url.toString(), method: 'POST', payload: application});
    console.log('created application', resp.value);
    if (resp.id) {
        return {
            id: resp.id,
            appId: resp.appId,
            displayName: resp.displayName,
        }
    }
}

async function createServicePrincipal(principal: ServicePrincipal): Promise<ServicePrincipal | undefined> {
    const url = new URL(graphConfig.graphServicePrincipalsEndpoint);
    const payload = {
        appId: principal.entraAppId,
        displayName: principal.displayName, 
        appRoleAssignmentRequired: true,
        servicePrincipalType: 'Application',
        preferredSingleSignOnMode: 'notSupported',
        tags: [
            'WindowsAzureActiveDirectoryCustomSingleSignOnApplication',
            'WindowsAzureActiveDirectoryIntegratedApp',
            `EBUuid-${principal.appId}`,
        ]
    };
    console.log('Creating service principal', payload);
    const resp = await callMsGraph({url: url.toString(), method: 'POST', payload});
    console.log('create service principal', resp.value);
    if (resp.id) {
        return {
            id: resp.id,
            appId: resp.appId,
            displayName: resp.displayName,
            url: principal.url,
        }
    }
}

type User = {
    id: string;
    userPrincipalName: string;
}

async function searchUserByUsername(username: string): Promise<User | undefined> {
    const principals: ServicePrincipal[] = [];
    const url = new URL(graphConfig.graphUsersEndpoint);
    url.searchParams.append("$filter", `userPrincipalName eq '${username}'`);
    const headers = new Headers();
    const resp = await callMsGraph({url: url.toString(), headers});
    console.log('User by username', resp.value);
    if (resp.value) {
        return {
            id: resp.value.id,
            userPrincipalName: resp.value.userPrincipalName,
        }
    }
}
