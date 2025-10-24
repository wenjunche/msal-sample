import { log } from "console";
import { loginRequest, graphConfig } from "../authConfig";
import { msalInstance } from "../index";
import { text } from "stream/consumers";

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

type CopilotConversationAttribution = {
    attributionSource: 'grounding' | 'model';
    attributionType: 'citation' | 'annotation';
    imageFavIcon: string;
    imageWebUrl: string;
    imageWidth: number;
    providerDisplayName: string;
    seeMoreWebUrl: string;
}

export type CopilotConversationResponseMessage = {
  id: string;
  createdDateTime: string;
  attributions: CopilotConversationAttribution[];
  text: string;
};

export type CopilotConversation = {
  id: string;
  createdDateTime: string;
  displayName?: string;
  messages?: CopilotConversationResponseMessage[];
  state: string;
  turnCount?: number;
};

export type CopilotMessage = {
  id?: string;
  content: string;
  role: "user" | "assistant";
  createdDateTime?: string;
  attachments?: CopilotAttachment[];
};

type CopilotAttachment = {
  id?: string;
  contentType: string;
  content: any;
};

type SharePointFileReference = {
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
};


export async function createCopilotConversation(): Promise<CopilotConversation> {
  const payload = {}; // Empty payload for creating a basic conversation
  const response = await callMsGraph({
    url: graphConfig.graphConversationEndpoint,
    method: "POST",
    payload
  }); 
  return response as CopilotConversation;
}

type GroundingOption = { enterprise: boolean; web: boolean; };

export async function sendCopilotMessage(conversationId: string, message: string, grounding: GroundingOption): Promise<CopilotConversation> {
  const payload = {
    message: {
        '@odata.type': '#microsoft.graph.copilotConversationRequestMessageParameter',
        text: message,
    },
    locationHint: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    contextualResources: {
        webContext: {
            isWebEnabled: grounding.web
        }
    }
  };

  const response = await callMsGraph({
    url: `${graphConfig.graphConversationEndpoint}/${conversationId}/chat`,
    method: "POST",
    payload
  }); 
  return response as CopilotConversation;
}

export async function sendCopilotMessageWithSharePointFile(
  conversationId: string,
  message: string,
  fileReference: SharePointFileReference
): Promise<CopilotMessage> {
  // Create file attachment reference
  const fileAttachment = {
    contentType: "sharePointFile",
    content: {
      siteId: fileReference.siteId,
      driveId: fileReference.driveId,
      itemId: fileReference.itemId,
      name: fileReference.name
    }
  };
  
  const payload = {
    content: message,
    role: "user",
    attachments: [fileAttachment]
  };
  
  const response = await callMsGraph({
    url: `${graphConfig.graphConversationEndpoint}/${conversationId}/messages`,
    method: "POST",
    payload
  });
  
  return response;
}

export async function getCopilotMessages(conversationId: string): Promise<CopilotMessage[]> {
  const response = await callMsGraph({
    url: `${graphConfig.graphConversationEndpoint}/${conversationId}/messages`
  });
  console.log("Fetched messages: ", response);
  return response.value;
}

export async function getCopilotMessage(conversationId: string, messageId: string): Promise<CopilotMessage> {
  const response = await callMsGraph({
    url: `${graphConfig.graphConversationEndpoint}/${conversationId}/messages/${messageId}`
  });  
  return response;
}

export async function getSharePointFileReference(
  siteUrl: string, 
  filePath: string
): Promise<SharePointFileReference> {
  // Extract site information
  const url = new URL(siteUrl);
  const sitePath = url.pathname;
  
  // Get the site ID
  const siteResponse = await callMsGraph({
    url: `${graphConfig.graphSitesEndpoint}/${url.hostname}:${sitePath}`
  });
  
  // Get the drive and file item
  const fileResponse = await callMsGraph({
    url: `${graphConfig.graphSitesEndpoint}/${siteResponse.id}/drive/root:${filePath}`
  });
  
  return {
    siteId: siteResponse.id,
    driveId: fileResponse.parentReference.driveId,
    itemId: fileResponse.id,
    name: fileResponse.name
  };
}

export async function chatWithCopilotAboutSharePointFile(
  sharePointSiteUrl: string,
  fileRelativePath: string,
  userMessage: string
): Promise<string> {
  try {
    console.log("Getting SharePoint file reference...");
    const fileRef = await getSharePointFileReference(
      sharePointSiteUrl, 
      fileRelativePath
    );
    
    console.log("Creating new Copilot conversation...");
    const conversation = await createCopilotConversation();
    
    console.log("Sending message with SharePoint file context...");
    await sendCopilotMessageWithSharePointFile(
      conversation.id,
      userMessage,
      fileRef
    );
    
    // Poll for assistant's response (in a real app, you might implement a better waiting strategy)
    console.log("Waiting for Copilot response...");
    let assistantResponse = "";
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const messages = await getCopilotMessages(conversation.id);
      const assistantMessages = messages.filter(msg => msg.role === "assistant");
      
      if (assistantMessages.length > 0) {
        assistantResponse = assistantMessages[assistantMessages.length - 1].content;
        break;
      }
      
      attempts++;
    }
    
    return assistantResponse || "No response received from Copilot after multiple attempts.";
  } catch (error) {
    console.error("Error in Copilot chat:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}