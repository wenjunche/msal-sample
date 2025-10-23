import { useEffect, useRef, useState } from "react";
import { getCopilotMessages, CopilotMessage } from "../utils/MsGraphApiCall";

export function useCopilotMessages(conversationId: string, pollInterval = 3000) {
    const [messages, setMessages] = useState<CopilotMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!conversationId) return;

        let isMounted = true;

        const fetchMessages = async () => {
            setLoading(true);
            try {
                const msgs = await getCopilotMessages(conversationId);
                if (isMounted) setMessages(msgs);
            } catch (err) {
                if (isMounted) setError(err as Error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMessages();
        intervalRef.current = setInterval(fetchMessages, pollInterval);

        return () => {
            isMounted = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [conversationId, pollInterval]);

    return { messages, loading, error };
}