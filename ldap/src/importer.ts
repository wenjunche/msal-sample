// importer.ts
import { Client } from 'ldapts';
import { settings } from './settings';

const { ldapUrl, bindDn, bindPassword, baseDn } = settings;

/**
 * Imports users from the LDAP directory.
 * This function connects to the LDAP server, binds with admin credentials,
 * and performs a search for user objects.
 */
export async function importUsers() {
  let client: Client | null = null;
  try {
    // 1. Create the LDAP client
    client = new Client({ url: ldapUrl });
    console.log('✅ LDAP client created.');

    // 2. Bind to the server with read-only credentials
    await client.bind(bindDn, bindPassword);
    console.log('✅ Successfully bound to LDAP server.');

    // 3. Define the search filter and attributes
    const searchOptions = {
      scope: 'sub' as const, // 'sub' for subtree search (all objects under baseDn)
      filter: '(objectClass=user)', // Filter for user objects
      attributes: ['cn', 'sAMAccountName', 'userPrincipalName', 'mail', 'givenName', 'sn', 'dn', 'msDS-aadObjectId'], // Attributes to retrieve
      paged: { // Use paged search to handle large numbers of users
        pageSize: 1000,
      },
    };

    // 4. Perform the search
    const { searchEntries } = await client.search(baseDn, searchOptions);
    
    console.log(`Successfully fetched ${searchEntries.length} users.`);
    
    // In a real microservice, you would now process and store this user data.
    searchEntries.forEach((user: any) => {
      console.log(`- User: ${user.cn} (${user.userPrincipalName}), Object ID: ${user['msDS-aadObjectId']}`);
    });

  } catch (error) {
    console.error('❌ Error during user import:', error);
  } finally {
    if (client) {
      await client.unbind();
      console.log('✅ Unbound from LDAP server.');
    }
  }
}

export async function importGroups() {
  let client: Client | null = null;
  try {
    client = new Client({ url: ldapUrl });
    console.log('✅ LDAP client created.');
    await client.bind(bindDn, bindPassword);
    console.log('✅ Successfully bound to LDAP server.');

    // 1. Define the search to find all groups
    const groupSearchOptions = {
      scope: 'sub' as const, // 'sub' for subtree search
      filter: '(objectClass=group)', // Filter for group objects
      // msDS-aadObjectId does not seem to be returned,  so still need to investigate how to get Object ID of groups
      attributes: ['cn', 'member', 'msDS-aadObjectId'], // 'member' attribute holds the DNs of members
      paged: {
        pageSize: 1000,
      },
    };

    // 2. Perform the search
    const { searchEntries: groups } = await client.search(baseDn, groupSearchOptions);

    console.log(`Successfully fetched ${groups.length} groups.`);

    groups.forEach((group: any) => {
      const members = group.member || []; // The 'member' attribute is an array of member DNs
      console.log(`- Group: ${group.cn}, Members: ${members.length}, Object ID: ${group['msDS-aadObjectId']}`);
      // In a real app, you would process and store this data
    });

  } catch (error) {
    console.error('❌ Error during group import:', error);
  } finally {
    if (client) {
      await client.unbind();
      console.log('✅ Unbound from LDAP server.');
    }
  }    

}

async function main() {
  try {
    await importUsers();
    await importGroups();
  } catch (error) {
    console.error('❌ Error during import:', error);
  }
}

// This will ensure that any unhandled promise rejections are logged.
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

main();