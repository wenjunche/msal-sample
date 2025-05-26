import { useEffect, useState } from "react";

// Msal imports
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { InteractionStatus, InteractionType, InteractionRequiredAuthError, AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

// Sample app imports
import { ProfileData, GraphData } from "../ui-components/ProfileData";
import { PrincipalData  } from "../ui-components/PrincipalData";
import { Loading } from "../ui-components/Loading";
import { ErrorComponent } from "../ui-components/ErrorComponent";
import { callMeGraph, callServicePrincipalGraph, ServicePrincipal } from "../utils/MsGraphApiCall";

// Material-ui imports
import Paper from "@mui/material/Paper";

const PrincipalContent = () => {
    const { instance, inProgress } = useMsal();
    const [principalData, setPrincipalData] = useState<null|ServicePrincipal[]>(null);

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
    }, [inProgress, instance, principalData]);
  
    return (
        <Paper>
            { principalData ? <PrincipalData principalData={principalData} /> : null }
        </Paper>
    );
};

export function Principal() {
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
            <PrincipalContent />
        </MsalAuthenticationTemplate>
      )
};