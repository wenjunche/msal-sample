import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

// Msal imports
import { MsalAuthenticationTemplate, useMsal } from "@azure/msal-react";
import { InteractionStatus, InteractionType, InteractionRequiredAuthError, AccountInfo } from "@azure/msal-browser";
import { loginRequest } from "../authConfig";

// Sample app imports
import { ProfileData, GraphData } from "../ui-components/ProfileData";
import { Loading } from "../ui-components/Loading";
import { ErrorComponent } from "../ui-components/ErrorComponent";
import { callMeGraph, CopilotConversationResponseMessage, CopilotMessage, createCopilotConversation, sendCopilotMessage } from "../utils/MsGraphApiCall";

// Material-ui imports
import Paper from "@mui/material/Paper";
import { Box, Button, Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from "@mui/material";
import { useCopilotMessages } from "../ui-components/useCopilotMessages.tsx";

const ChatContent = () => {
    const { instance, inProgress } = useMsal();
    const [graphData, setGraphData] = useState<null|GraphData>(null);
    const [copilotConversationId, setCopilotConversationId] = useState<string>('');
    const [input, setInput] = useState("");
    const [copilotResponses, setCopilotResponses] = useState<CopilotConversationResponseMessage[]>([]);
    const [enterpriseChecked, setEnterpriseChecked] = useState(true);
    const [webChecked, setWebChecked] = useState(false);

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
            const response = await sendCopilotMessage(copilotConversationId, input, { 
                enterprise: enterpriseChecked, 
                web: webChecked, 
            });
            console.log("Sent message to Copilot: ", response);
            if (response.messages) {
                setCopilotResponses(response.messages);
            }
            setInput("");
        } catch (error) {
            console.error("Error sending message to Copilot: ", error);
        }
    };

    return (
        <Box
            sx={{
                width: 600,
                height: 500,
                border: "1px solid #ccc",
                borderRadius: 2,
                display: "flex",
                flexDirection: "column",
                p: 2,
            }}
        >
            {copilotConversationId ?
                <ChatHistory messages={copilotResponses} />
            : null}
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
            <FormGroup row sx={{ mt: 1, justifyContent: "center" }}>
                <Stack direction="row" alignItems="center" spacing={2}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Grounding:
                    </Typography>
                    {/* <FormControlLabel control={<Checkbox checked={enterpriseChecked} onChange={(e) => setEnterpriseChecked(e.target.checked)} />} label="Enterprise" /> */}
                    <FormControlLabel control={<Checkbox checked={webChecked} onChange={(e) => setWebChecked(e.target.checked)} />} label="Web" />
                </Stack>
            </FormGroup>
        </Box>
    );
};

const preprocessCopilotText = (text: string, attributions: any[] = []) => {
    console.log("Preprocessing text: ", text);
       // Remove Copilot PUA markers
    let cleaned = text.replace(/\uE200.*?\uE201/g, "");

    // Replace <File>...</File> with markdown links if possible
    cleaned = cleaned.replace(/<File>(.*?)<\/File>/g, (match, fileName) => {
        const attr = attributions.find(a =>
            a.attributionType === "citation" && a.providerDisplayName === fileName
        );
        if (attr && attr.seeMoreWebUrl) {
            return `[${fileName}](${attr.seeMoreWebUrl})`;
        }
        return `**${fileName}**`;
    });

    // Replace <Event>...</Event> and <Person>...</Person> with markdown bold and a marker
    cleaned = cleaned
        .replace(/<Event>(.*?)<\/Event>/g, '**$1**')
        .replace(/<Person>(.*?)<\/Person>/g, '*$1*');


   // Fix quadruple asterisks (****text****) to double asterisks (**text**)
    cleaned = cleaned.replace(/\*{4}(.*?)\*{4}/g, '**$1**');

    // Optionally, fix triple asterisks (***text***) to bold+italic or just bold
    cleaned = cleaned.replace(/\*{3}(.*?)\*{3}/g, '**$1**');

    console.log("Cleaned text: ", cleaned);
    return cleaned;
}

const ChatHistory = ({ messages }: { messages: CopilotConversationResponseMessage[] }) => {

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
                alignSelf: i === 0 ? "flex-end" : "flex-start",
                bgcolor: i === 0 ? "primary.main" : "grey.300",
                color: i === 0 ? "white" : "black",
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                maxWidth: "75%",
                }}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[]}>
                    {preprocessCopilotText(msg.text || '', msg.attributions)}
                </ReactMarkdown>
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