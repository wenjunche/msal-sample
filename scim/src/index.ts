import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// --- Configuration & In-Memory Data Store ---

// Replace with a secure, long-lived token. This token will be used
// to authenticate requests from Azure Entra ID.
const BEARER_TOKEN = 'c6e22947-681c-4448-9ac6-1d17bc0dd7e2';

// In-memory "database" to simulate user storage.
interface ScimUser {
  id: string;
  userName: string;
  active: boolean;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{ value: string; type: string }>;
  externalId?: string;
  // SCIM metadata is required for responses
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

interface ScimGroup {
  id: string;
  displayName: string;
  externalId: string;
  members: Array<{ value: string; display: string }>;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

interface ScimOperation {
  op: string;
  path: string;
  value: any[];
}

const users: Map<string, ScimUser> = new Map();
const groups: Map<string, ScimGroup> = new Map();

// --- Middleware for Authentication ---
const authenticateScim = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      scimType: 'invalidCreds',
      detail: 'Authorization token not provided or is invalid.'
    });
  }

  const token = authHeader.split(' ')[1];
  if (token !== BEARER_TOKEN) {
    return res.status(401).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      scimType: 'invalidCreds',
      detail: 'Invalid bearer token.'
    });
  }
  next();
};

// --- Helper Functions ---
const createScimUser = (userData: any): ScimUser => {
  const now = new Date().toISOString();
  const newId = uuidv4();
  return {
    id: newId,
    userName: userData.userName,
    active: userData.active ?? true,
    name: {
      givenName: userData.name?.givenName || '',
      familyName: userData.name?.familyName || '',
    },
    emails: userData.emails || [],
    externalId: userData.externalId,
    meta: {
      resourceType: 'User',
      created: now,
      lastModified: now,
      location: `/scim/v2/Users/${newId}`,
    },
  };
};

const updateUser = (existingUser: ScimUser, updateData: any): ScimUser => {
    // SCIM PATCH can get complex. This is a simple update logic.
    existingUser.active = updateData.active ?? existingUser.active;
    existingUser.name.givenName = updateData.name?.givenName ?? existingUser.name.givenName;
    existingUser.name.familyName = updateData.name?.familyName ?? existingUser.name.familyName;
    existingUser.emails = updateData.emails ?? existingUser.emails;
    existingUser.userName = updateData.userName ?? existingUser.userName;

    existingUser.meta.lastModified = new Date().toISOString();
    return existingUser;
};

const createScimGroup = (groupData: any): ScimGroup => {
  const now = new Date().toISOString();
  const newId = uuidv4();
  return {
    id: newId,
    displayName: groupData.displayName,
    externalId: groupData.externalId,
    members: groupData.members || [],
    meta: {
      resourceType: 'Group',
      created: now,
      lastModified: now,
      location: `/scim/v2/Groups/${newId}`,
    },
  };
};

const updateGroupMembers = (existingGroup: ScimGroup, operations: ScimOperation[]) => {
    operations.forEach(op => {
        if (op.op.toLowerCase() === 'add' && op.path.toLowerCase() === 'members') {
            const memberId = op.value[0].value;
            const user = users.get(memberId);
            if (user) {
                const member = { value: memberId, display: user.userName };
                if (!existingGroup.members.some(m => m.value === memberId)) {
                    console.log(`Adding user member ${memberId} to group ${existingGroup.id}`);
                    existingGroup.members.push(member);
                }
            } else {
              const group = groups.get(memberId);
              if (group) {
                const member = { value: memberId, display: group.displayName };
                if (!existingGroup.members.some(m => m.value === memberId)) {
                    console.log(`Adding group member ${memberId} to group ${existingGroup.id}`);
                    existingGroup.members.push(member);
                }
              } else {
                console.warn(`member not found ${memberId}`);
              }
            }
        }
        if (op.op === 'remove' && op.path === 'members') {
            const memberId = op.value[0].value;
            console.log(`Removing member ${memberId} from group ${existingGroup.id}`);
            existingGroup.members = existingGroup.members.filter(m => m.value !== memberId);
        }
    });
    console.log('Updated members', JSON.stringify(existingGroup));
};

// --- Express App & SCIM Endpoints ---
const app = express();
app.use(express.json({ type: ['application/json', 'application/scim+json'] })); // SCIM uses application/scim+json
const PORT = 3000;

// SCIM API Base Path
const scimRouter = express.Router();
scimRouter.use(authenticateScim); // Apply authentication middleware to all SCIM routes

// /Users Endpoint
scimRouter.post('/Users', (req: Request, res: Response) => {
  console.log('Received SCIM POST request to create a user:', JSON.stringify(req.body));
  const newUser = createScimUser(req.body);
  users.set(newUser.id, newUser);
  console.log(`User created with ID: ${newUser.id}`, newUser);
  res.status(201).json(newUser);
});

scimRouter.get('/Users/:id', (req: Request, res: Response) => {
  console.log(`Received SCIM GET request for user with ID: ${req.params.id}`);
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: `User with ID ${req.params.id} not found.`
    });
  }
  console.log('return', JSON.stringify(user));
  res.status(200).json(user);
});

scimRouter.put('/Users/:id', (req: Request, res: Response) => {
    console.log(`Received SCIM PUT request for user with ID: ${req.params.id}`);
    const existingUser = users.get(req.params.id);
    if (!existingUser) {
      return res.status(404).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        detail: `User with ID ${req.params.id} not found.`
      });
    }

    const updatedUser = updateUser(existingUser, req.body);
    users.set(updatedUser.id, updatedUser);
    console.log(`User updated with ID: ${updatedUser.id}`, updatedUser);
    res.status(200).json(updatedUser);
});

scimRouter.delete('/Users/:id', (req: Request, res: Response) => {
  console.log(`Received SCIM DELETE request for user with ID: ${req.params.id}`);
  const userExists = users.has(req.params.id);
  if (!userExists) {
    return res.status(404).end(); // SCIM standard for not found on DELETE
  }
  users.delete(req.params.id);
  res.status(204).end(); // SCIM standard for successful DELETE
});

// To fulfill a PATCH request (e.g., for deactivation)
scimRouter.patch('/Users/:id', (req: Request, res: Response) => {
  console.log(`Received SCIM PATCH request for user with ID: ${req.params.id}`, JSON.stringify(req.body));
  const existingUser = users.get(req.params.id);
  if (!existingUser) {
    return res.status(404).end();
  }

  // A typical SCIM PATCH request to deactivate a user might look like:
  // { "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], "Operations": [{ "op": "replace", "path": "active", "value": false }] }
  if (req.body.Operations) {
    req.body.Operations.forEach((op: any) => {
      if (op.op === 'replace' && op.path === 'active') {
        existingUser.active = op.value;
      }
    });
  }
  existingUser.meta.lastModified = new Date().toISOString();
  res.status(200).json(existingUser);
});

// The /Users endpoint requires filtering to support the initial sync
scimRouter.get('/Users', (req: Request, res: Response) => {
    console.log(`Received SCIM GET request for all users with filters: ${JSON.stringify(req.query)}`);
    const filter = req.query.filter as string;
    let filteredUsers = Array.from(users.values());

    if (filter) {
        // Simple example for a filter like 'externalId eq "..."' or 'userName eq "..."'
        // In a real implementation, you'd need a more robust filter parser.
        const parts = filter.split(' ');
        if (parts.length === 3 && parts[1] === 'eq') {
            const [attribute, , value] = parts;
            // Remove quotes from value
            const sanitizedValue = value.replace(/"/g, '');

            filteredUsers = filteredUsers.filter(user => {
                if (attribute === 'userName') {
                    return user.userName === sanitizedValue;
                }
                if (attribute === 'externalId') {
                    return user.externalId === sanitizedValue;
                }
                return false;
            });
        }
    }

    res.status(200).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: filteredUsers.length,
        startIndex: 1,
        itemsPerPage: filteredUsers.length,
        Resources: filteredUsers
    });
});


// --- /Groups Endpoint (NEW) ---
scimRouter.post('/Groups', (req: Request, res: Response) => {
  console.log('Received SCIM POST request to create a group:', JSON.stringify(req.body));
  console.log(JSON.stringify(req.body));
  const newGroup = createScimGroup(req.body);
  groups.set(newGroup.id, newGroup);
  console.log('created', JSON.stringify(newGroup));
  res.status(201).json(newGroup);
});

scimRouter.get('/Groups/:id', (req: Request, res: Response) => {
  console.log(`Received SCIM GET request for group with ID: ${req.params.id}`);
  const group = groups.get(req.params.id);
  if (!group) {
    return res.status(404).json({
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail: `Group with ID ${req.params.id} not found.`
    });
  }
  console.log(`return ${JSON.stringify(group)}`);
  res.status(200).json(group);
});

scimRouter.delete('/Groups/:id', (req: Request, res: Response) => {
  console.log(`Received SCIM DELETE request for group with ID: ${req.params.id}`);
  const groupExists = groups.has(req.params.id);
  if (!groupExists) {
    return res.status(404).end();
  }
  groups.delete(req.params.id);
  res.status(204).end();
});

scimRouter.patch('/Groups/:id', (req: Request, res: Response) => {
    console.log(`Received SCIM PATCH request for group with ID: ${req.params.id}`);
    console.log(JSON.stringify(req.body));
    const existingGroup = groups.get(req.params.id);
    if (!existingGroup) {
      return res.status(404).end();
    }
    
    // Group patching from Entra ID often involves adding/removing members
    if (req.body.Operations) {
        updateGroupMembers(existingGroup, req.body.Operations);
    }

    existingGroup.meta.lastModified = new Date().toISOString();
    res.status(200).json(existingGroup);
});

// The /Groups endpoint requires filtering to support the initial sync
scimRouter.get('/Groups', (req: Request, res: Response) => {
    console.log('Received SCIM GET request for all groups with filters:', req.query);
    const filter = req.query.filter as string;
    let filteredGroups = Array.from(groups.values());

    if (filter) {
        // Simple example for a filter like 'displayName eq "..."'
        const parts = filter.split(' ');
        if (parts.length === 3 && parts[1] === 'eq') {
            const [attribute, , value] = parts;
            const sanitizedValue = value.replace(/"/g, '');

            filteredGroups = filteredGroups.filter(group => {
                if (attribute === 'displayName') {
                    return group.displayName === sanitizedValue;
                }
                return false;
            });
        }
    }

    console.log('return', JSON.stringify(filteredGroups));
    res.status(200).json({
        schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        totalResults: filteredGroups.length,
        startIndex: 1,
        itemsPerPage: filteredGroups.length,
        Resources: filteredGroups
    });
});


const scimBasePath = '/scim/api/v2';

app.use(scimBasePath, scimRouter);

app.listen(PORT, () => {
  console.log(`SCIM 2.0 API server running at http://localhost:${PORT}${scimBasePath}`);
  console.log('Use "npm run start" to run in production mode.');
});
