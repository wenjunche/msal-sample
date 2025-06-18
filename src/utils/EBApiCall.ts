import { ServicePrincipal } from "./MsGraphApiCall";
import { handleAPIRequest } from "./requests";

const defaultHeaders: HeadersInit = {};

export type CreateAppPayload = {
    name: string;
    contentId: string;
    customLabel?: string;
    urls?: string[];
    contentType: 'web' | 'desktop';
    nativeSettings?: {
        nativePath?: string;
        nativeArgs?: string[];
        withSnap?: boolean;
    };
    active: boolean;
    hereApiAccess: boolean;
    enableSimpleWindow: boolean;
    featured: boolean;
    useAIContext: boolean;
    icon?: string;
    access: {
        primitives: string[];
        subjects: string[];
    };
    dataLossPreventionSettings: {
        copyBehavior: 'block' | 'protect' | 'allow';
        pasteBehavior: 'non-protected-content' | 'all-content';
        screenCaptureBehavior: 'allow' | 'block';
        printBehavior: 'block' | 'allow';
    };
    viewSettings: {
        navigationControls: boolean;
        reloadControl: boolean;
    };
    redirects: {
        id: string;
        name: string;
        description: string;
        createdAt?: Date;
        redirectDetails: {
            domains: string[];
            name?: string;
            icon?: string;
        };
        assignees: {
            subjects: string[];
            primitives: string[];
        };
    }[];
};

type CommonContentItemProps = {
    /**
     * UUID we generate
     */
    id: string;
    /**
     * Display name of the app
     */
    name: string;
    /**
     * unique ID the admin provides
     */
    contentId: string;
    customLabel?: string;
    active: boolean;
    featured: boolean;
    icon: string;
};
export type ContentItem = {
    domains: string[];
    access: {
        subjectIds: string[];
        primitiveIds: string[];
    };
    redirects: {
        id: string;
        name: string;
        description: string;
        createdAt: string;
        redirectDetails: {
            domains: string[];
            name?: string;
            icon?: string;
        };
        assignees: {
            subjects: string[];
            primitives: string[];
        };
    }[];
} & CommonContentItemProps;

export async function getAllApps(): Promise<ContentItem[]> {
    const response = await handleAPIRequest<ContentItem[]>(`/platform/api/admin/apps`, {
        method: 'GET',
        headers: defaultHeaders,
    });

    return response.map((app) => ({
        ...app,
        redirects: app.redirects.map((redirect) => ({
            ...redirect,
            createdAt: new Date(redirect.createdAt).toISOString(),
        })),
    }));
}

async function createApp(app: CreateAppPayload): Promise<void> {
    return handleAPIRequest(`/platform/api/admin/apps`, {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
            application: {
                ...app,
                redirects: app.redirects.map((redirect) => ({
                    ...redirect,
                    id: redirect.id.startsWith('new-redirect-') ? undefined : redirect.id,
                })),
            },
        }),
    });
}

function mapServicePrincipalToApp(app: ServicePrincipal, ebUsers: User[]): CreateAppPayload {
    const urls: string[] = [ app.url ];
    const subjects: string[] = [];

    if (app.customSecurityAttributes?.Domains) {
        urls.push(...app.customSecurityAttributes?.Domains);
    }
    if (app.users && app.users.length > 0) {
        app.users.forEach((user) => {
            const foundUser = ebUsers.find((u) => u.username === user.username);
            if (foundUser) {
                subjects.push(foundUser.uuid);
            } else {
                console.warn(`User ${user.username} not found in EB users list.`);
            }
        });
    }
    return {
        name: app.displayName,
        contentId: app.appId,
        urls,
        contentType: 'web',
        active: true,
        hereApiAccess: false,
        enableSimpleWindow: false,
        featured: false,
        useAIContext: false,
//        icon: app.logoUrl || '',
        access: {
            primitives: [],
            subjects,
        },
        dataLossPreventionSettings: {
            copyBehavior: 'block',
            pasteBehavior: 'non-protected-content',
            screenCaptureBehavior: 'allow',
            printBehavior: 'block',
        },
        viewSettings: {
            navigationControls: true,
            reloadControl: true,
        },
        redirects: [],
    };
}

export async function syncApplications(principals: ServicePrincipal[]): Promise<void> {
    const users = await getAllUsers();
    const existingApps = await getAllApps();

    for (const principal of principals) {
        if (principal.customSecurityAttributes && principal.customSecurityAttributes.EBEnabled) {
            const existingApp = existingApps.find((app) => app.contentId === principal.appId);
            if (existingApp) {
                console.log(`Application already exists: ${principal.displayName} (${principal.appId})`);
                continue; // Skip if the app already exists
            }
            console.log(`Syncing application: ${principal.displayName} (${principal.appId})`);
            const app = mapServicePrincipalToApp(principal, users);
            console.log(`Creating app with payload:`, app);
            await createApp(app);
        } else {
            console.log(`Skipping application: ${principal.displayName} (${principal.appId}) - EBEnabled is false`);
        }
    };
    console.log("Application sync completed.");
}

type User = {
    id: string;
    uuid: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    primaryGroup: { id: string; displayName: string };
    groups?: { id: string; displayName: string; name: string }[];
    roles?: { id: string; displayName: string; name: string }[];
    active: boolean;
};

async function getAllUsers(): Promise<User[]> {
    return handleAPIRequest(`/platform/api/admin/users`, { method: 'GET', headers: defaultHeaders });
}

export async function getEntraApplications(): Promise<ServicePrincipal[]> {
    const existingApps = await getAllApps();
    const ebUsers = await getAllUsers();
    const entraApps = existingApps.filter((app) => app.customLabel === 'Entra Enabled').map((app) => {
        return mapAppToServicePrincipal(app, ebUsers);
    });
    console.log("Entra Enabled Applications: ", entraApps);
    return entraApps
}


export function mapAppToServicePrincipal(content: ContentItem, ebUsers: User[]): ServicePrincipal {
    const principal: ServicePrincipal = {
        appId: content.id,
        displayName: content.name,
        loginUrl: content.domains[0] || '',
        users: [],
        groups: [],
        customSecurityAttributes: {
            Domains: content.domains,
            EBEnabled: true,
        },
        url: ""
    };
    
    content.access.subjectIds.forEach((subjectId) => {
        const foundUser = ebUsers.find((user) => user.uuid === subjectId);
        if (foundUser) {
            principal.users.push({
                username: foundUser.username,
                displayName: foundUser.firstName ? `${foundUser.firstName} ${foundUser.lastName}` : foundUser.username,
                givenName: foundUser.firstName || '',
                surname: foundUser.lastName || '',
            });
        }
    });
    return principal;
}

