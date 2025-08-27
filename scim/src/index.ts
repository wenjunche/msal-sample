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

const users: Map<string, ScimUser> = new Map();

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

// --- Express App & SCIM Endpoints ---
const app = express();
app.use(express.json({ type: ['application/json', 'application/scim+json'] })); // SCIM uses application/scim+json
const PORT = 3000;

// SCIM API Base Path
const scimRouter = express.Router();
scimRouter.use(authenticateScim); // Apply authentication middleware to all SCIM routes

// /Users Endpoint
scimRouter.post('/Users', (req: Request, res: Response) => {
  console.log('Received SCIM POST request to create a user:', req.body.userName);
  const newUser = createScimUser(req.body);
  users.set(newUser.id, newUser);
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
  console.log(`Received SCIM PATCH request for user with ID: ${req.params.id}`);
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
    console.log('Received SCIM GET request for all users with filters:', req.query);
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

app.use('/scim/v2', scimRouter);

app.listen(PORT, () => {
  console.log(`SCIM 2.0 API server running at http://localhost:${PORT}/scim/v2`);
  console.log('Use "npm run start" to run in production mode.');
});
