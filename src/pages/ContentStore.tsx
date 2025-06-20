import { useCallback, useEffect, useState } from "react";

// Msal imports
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { InteractionStatus, InteractionType, InteractionRequiredAuthError, AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

// Sample app imports
import { Loading } from "../ui-components/Loading";
import { ErrorComponent } from "../ui-components/ErrorComponent";
import { callServicePrincipalGraph, ServicePrincipal, syncApplicationsToEntra } from "../utils/MsGraphApiCall";

// Material-ui imports
import Paper from "@mui/material/Paper";
import { Button } from "@mui/material";
import { ContentItem, getAllApps, getEntraApplications, syncApplications } from "../utils/EBApiCall";
import { ContentData } from "../ui-components/ContentData";

const StoreContent = () => {
    const { instance, inProgress } = useMsal();
    const [principalData, setPrincipalData] = useState<null|ServicePrincipal[]>(null);
    const [contentData, setContentData] = useState<null|ServicePrincipal[]>(null);

    useEffect(() => {
        if (!principalData && inProgress === InteractionStatus.None) {
            callServicePrincipalGraph().then(response => {
                setPrincipalData(response);
            }).catch((e) => {
                if (e instanceof InteractionRequiredAuthError) {
                    instance.acquireTokenRedirect({
                        ...loginRequest,
                        account: instance.getActiveAccount() as AccountInfo
                    });
                }
            });
        }
        if (!contentData && inProgress === InteractionStatus.None) {
            getEntraApplications().then(response => {
                setContentData(response);
            }).catch((e) => {
                console.error("Error fetching content data: ", e);
            });
        }
    }, [inProgress, instance, principalData, contentData]);
  
    const handleClick = useCallback(() => {
        console.log("Syncing apps to Entra...");
        syncApplicationsToEntra(contentData || []);
    }, [ contentData ]);

    return (
        <Paper>
            { contentData ? <ContentData contentData={contentData} /> : null }
                <Button variant="contained" onClick={handleClick}>
                    Sync apps to Entra
                </Button>
        </Paper>
    );
};



export function ContentStore() {
    const authRequest = {
        ...loginRequest
    };

    return (
        <MsalAuthenticationTemplate 
            interactionType={InteractionType.Redirect} 
            authenticationRequest={authRequest} 
            errorComponent={ErrorComponent} 
            loadingComponent={Loading}
        >
            <StoreContent />
        </MsalAuthenticationTemplate>
      )
};