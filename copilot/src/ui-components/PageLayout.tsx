import Typography from "@mui/material/Typography";
import NavBar from "./NavBar";

type Props = {
    children?: React.ReactNode;
};

export const PageLayout: React.FC<Props> = ({children}) => {
    return (
        <>
            <NavBar />
            <Typography variant="h5" align="center">Chat with MS365 Copilot</Typography>
            <br/>
            <br/>
            {children}
        </>
    );
};