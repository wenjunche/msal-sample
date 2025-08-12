// settings.ts
import * as dotenv from 'dotenv';
dotenv.config();

export const settings = {
  // The URL of your LDAP server (from Entra Domain Services).
  // Use ldaps:// for secure connections (recommended). Port 636 is default for LDAPS.
  ldapUrl: process.env.LDAP_URL || 'ldaps://your-domain-services-name.com:636',

  // The distinguished name (DN) of a user with read access to the directory.
  // This is for binding to the LDAP server.
  // Example: 'contosoadmin@your-domain-services-name.com'
  bindDn: process.env.LDAP_BIND_DN || 'yourbinduser@yourdomain.com',

  // The password for the bind user.
  bindPassword: process.env.LDAP_BIND_PASSWORD || 'YourSecretPassword!',

  // The base distinguished name to search from.
  // This should be the root of your domain.
  // Example: 'dc=yourdomain,dc=com'
  baseDn: process.env.LDAP_BASE_DN || 'dc=yourdomain,dc=com',
};