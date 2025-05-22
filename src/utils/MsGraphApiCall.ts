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


async function searchServicePrincipals() {
    const url = new URL(graphConfig.graphServicePrincipalsEndpoint);
    url.searchParams.append("$filter", `customSecurityAttributes/${HereAttributeSet}/${HereEnableAttribute} eq true`);
    url.searchParams.append("$select", "id,appId,displayName,customSecurityAttributes");
    const headers = new Headers();
    headers.append("ConsistencyLevel", "eventual");
    const resp = await callMsGraph(url.toString(), headers);
    console.log('Service Principals', resp.value);
}

