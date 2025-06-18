import Typography from "@mui/material/Typography";
import NavBar from "./NavBar";

type Props = {
    children?: React.ReactNode;
};

export const PageLayout: React.FC<Props> = ({children}) => {
    return (
        <>
            <NavBar />
            <Typography variant="h5" align="center">Enterprise Browser Admain App for Entra Integration</Typography>
            <br/>
            <br/>
            {children}
        </>
    );
};