import List from "@mui/material/List";
import Typography from "@mui/material/Typography";

import { ContentItem } from "../utils/EBApiCall";
import { ServicePrincipal } from "../utils/MsGraphApiCall";

export const ContentData: React.FC<{contentData: ServicePrincipal[]}> = ({contentData}) => {
    return (

        <Typography component="pre" sx={{ fontFamily: 'monospace' }}>
             {JSON.stringify(contentData, null, 2)}
        </Typography>

    );
};
