import { getDb } from '../../../sqlite-db';

type AccountRecord = {
  id?: number;
  companyName: string;
  region?: string;
  industry?: string;
  website?: string;
  taxCode?: string;
  address?: string;
  assignedTo?: string;
  status?: string;
  accountType?: string;
  code?: string;
  shortName?: string;
  description?: string;
  tag?: string;
  country?: string;
};

type ContactRecord = {
  id?: number;
  accountId?: number;
  lastName?: string;
  firstName?: string;
  department?: string;
  jobTitle?: string;
  gender?: string;
  email?: string;
  phone?: string;
  isPrimaryContact?: number;
};

type LeadRecord = {
  id?: number;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  status?: string;
  source?: string;
};

export function createCrmRepository() {
  return {
    listAccounts(type?: unknown) {
      return type
        ? getDb().all('SELECT * FROM Account WHERE accountType = ? ORDER BY createdAt DESC', type)
        : getDb().all('SELECT * FROM Account ORDER BY createdAt DESC');
    },

    findAccountById(id: string) {
      return getDb().get('SELECT * FROM Account WHERE id = ?', id);
    },

    insertAccount(account: AccountRecord) {
      return getDb().run(
        `INSERT INTO Account (companyName, region, industry, website, taxCode, address, assignedTo, status, accountType, code, shortName, description, tag, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          account.companyName,
          account.region,
          account.industry,
          account.website,
          account.taxCode,
          account.address,
          account.assignedTo,
          account.status,
          account.accountType,
          account.code,
          account.shortName,
          account.description,
          account.tag,
          account.country,
        ],
      );
    },

    async updateAccountById(id: string, account: Omit<AccountRecord, 'id'>) {
      await getDb().run(
        `UPDATE Account SET companyName=?, region=?, industry=?, website=?, taxCode=?, address=?, assignedTo=?, status=?, accountType=?, code=?, shortName=?, description=?, tag=?, country=? WHERE id=?`,
        [
          account.companyName,
          account.region,
          account.industry,
          account.website,
          account.taxCode,
          account.address,
          account.assignedTo,
          account.status,
          account.accountType,
          account.code,
          account.shortName,
          account.description,
          account.tag,
          account.country,
          id,
        ],
      );
    },

    deleteAccountById(id: string) {
      return getDb().run('DELETE FROM Account WHERE id = ?', id);
    },

    listContacts(accountId?: unknown) {
      return accountId
        ? getDb().all('SELECT * FROM Contact WHERE accountId = ?', accountId)
        : getDb().all('SELECT * FROM Contact');
    },

    findContactById(id: string) {
      return getDb().get('SELECT * FROM Contact WHERE id = ?', id);
    },

    insertContact(contact: ContactRecord) {
      return getDb().run(
        `INSERT INTO Contact (accountId, lastName, firstName, department, jobTitle, gender, email, phone, isPrimaryContact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contact.accountId,
          contact.lastName,
          contact.firstName,
          contact.department,
          contact.jobTitle,
          contact.gender,
          contact.email,
          contact.phone,
          contact.isPrimaryContact ?? 0,
        ],
      );
    },

    async updateContactById(id: string, contact: Omit<ContactRecord, 'id'>) {
      await getDb().run(
        `UPDATE Contact SET accountId=?, lastName=?, firstName=?, department=?, jobTitle=?, gender=?, email=?, phone=?, isPrimaryContact=? WHERE id=?`,
        [
          contact.accountId,
          contact.lastName,
          contact.firstName,
          contact.department,
          contact.jobTitle,
          contact.gender,
          contact.email,
          contact.phone,
          contact.isPrimaryContact ?? 0,
          id,
        ],
      );
    },

    deleteContactById(id: string) {
      return getDb().run('DELETE FROM Contact WHERE id = ?', id);
    },

    listLeads() {
      return getDb().all('SELECT * FROM Lead ORDER BY createdAt DESC');
    },

    findLeadById(id: string) {
      return getDb().get('SELECT * FROM Lead WHERE id = ?', id);
    },

    insertLead(lead: LeadRecord) {
      return getDb().run(
        `INSERT INTO Lead (companyName, contactName, email, phone, status, source) VALUES (?, ?, ?, ?, ?, ?)`,
        [lead.companyName, lead.contactName, lead.email, lead.phone, lead.status, lead.source],
      );
    },

    async updateLeadById(id: string, lead: Omit<LeadRecord, 'id'>) {
      await getDb().run(
        `UPDATE Lead SET companyName=?, contactName=?, email=?, phone=?, status=?, source=? WHERE id=?`,
        [lead.companyName, lead.contactName, lead.email, lead.phone, lead.status, lead.source, id],
      );
    },

    deleteLeadById(id: string) {
      return getDb().run('DELETE FROM Lead WHERE id = ?', id);
    },
  };
}
