import { AuthenticatedTemplate, UnauthenticatedTemplate } from "@azure/msal-react";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

export function Home() {
  return (
      <>
          <AuthenticatedTemplate>
            <ButtonGroup orientation="vertical">
              <Button component={RouterLink} to="/build/profile" variant="contained" color="primary">Request Profile Information</Button>
              <Button component={RouterLink} to="/build/principal" variant="contained" color="primary">Request Application Infomation</Button>
            </ButtonGroup>
          </AuthenticatedTemplate>

          <UnauthenticatedTemplate>
            <Typography variant="h6" align="center">Please sign-in to see your profile information.</Typography>
          </UnauthenticatedTemplate>
      </>
  );
}
