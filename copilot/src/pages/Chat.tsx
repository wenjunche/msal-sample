import { useEffect, useState } from "react";

// Msal imports
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { InteractionStatus, InteractionType, InteractionRequiredAuthError, AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

// Sample app imports
import { ProfileData, GraphData } from "../ui-components/ProfileData";
import { Loading } from "../ui-components/Loading";
import { ErrorComponent } from "../ui-components/ErrorComponent";
import { callMeGraph, CopilotMessage, createCopilotConversation, sendCopilotMessage } from "../utils/MsGraphApiCall";

// Material-ui imports
import Paper from "@mui/material/Paper";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useCopilotMessages } from "../ui-components/useCopilotMessages.tsx";

const ChatContent = () => {
    const { instance, inProgress } = useMsal();
    const [graphData, setGraphData] = useState<null|GraphData>(null);
    const [copilotConversationId, setCopilotConversationId] = useState<string>('');
    const [input, setInput] = useState("");

    useEffect(() => {
        if (!graphData && inProgress === InteractionStatus.None) {
            callMeGraph().then(response => {
                setGraphData(response);
            }).catch((e) => {
                if (e instanceof InteractionRequiredAuthError) {
                    instance.acquireTokenRedirect({
                        ...loginRequest,
                        account: instance.getActiveAccount() as AccountInfo
                    });
                }
            });
        }
    }, [inProgress, graphData, instance]);
  
    useEffect(() => {
        const initCopilotConversation = async () => {
            if (graphData) {
                const conversation = await createCopilotConversation();
                console.log("Created Copilot conversation: ", conversation);
                setCopilotConversationId(conversation.id);
                const response = await sendCopilotMessage(conversation.id, "Hello Copilot!");
                console.log("Sent message to Copilot: ", response);
            }
        };
        initCopilotConversation();
    }, [graphData]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
        }
    };
    const handleSend = async () => {
        if (input.trim() === "" || copilotConversationId === "") return;
        try {
            const response = await sendCopilotMessage(copilotConversationId, input);
            console.log("Sent message to Copilot: ", response);
            setInput("");
        } catch (error) {
            console.error("Error sending message to Copilot: ", error);
        }
    };

    return (
        <Box
            sx={{
                width: 400,
                height: 500,
                border: "1px solid #ccc",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                p: 2,
            }}
        >
            {/* {copilotConversationId ?
                <ChatHistory conversationId={copilotConversationId} />
            : null} */}
            <Stack direction="row" spacing={1}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                />
                <Button variant="contained" onClick={handleSend}>
                Send
                </Button>
            </Stack>
        </Box>
    );
};

const ChatHistory = ({ conversationId }: { conversationId: string }) => {
    const { messages, loading, error } = useCopilotMessages(conversationId, 8000)

    return (
        <Box
            sx={{
            flex: 1,
            overflowY: "auto",
            mb: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            }}
        >
            {messages.map((msg, i) => (
            <Paper
                key={i}
                sx={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                bgcolor: msg.role === "user" ? "primary.main" : "grey.300",
                color: msg.role === "user" ? "white" : "black",
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                maxWidth: "75%",
                }}
            >
                <Typography variant="body2">{msg.content}</Typography>
            </Paper>
            ))}
        </Box>        
    );
}

export function Chat() {
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
            <ChatContent />
        </MsalAuthenticationTemplate>
      )
};