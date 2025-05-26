import List from "@mui/material/List";
import Typography from "@mui/material/Typography";

import { ServicePrincipal } from "../utils/MsGraphApiCall";

export const PrincipalData: React.FC<{principalData: ServicePrincipal[]}> = ({principalData}) => {
    return (

        <Typography component="pre" sx={{ fontFamily: 'monospace' }}>
             {JSON.stringify(principalData, null, 2)}
        </Typography>

    );
};
