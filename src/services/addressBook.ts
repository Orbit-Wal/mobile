import * as Crypto from "expo-crypto";
import { saveContacts, loadContacts } from "@/services/secureStorage";
import type { Contact } from "@/types";

// See secureStorage.ts's saveContacts/loadContacts for the SecureStore-vs-
// AsyncStorage storage-tier rationale (issue #20). This module is the CRUD
// surface UI code calls into -- app/contacts/index.tsx.

export { loadContacts };

export async function addContact(label: string, address: string): Promise<Contact[]> {
  const contacts = await loadContacts();
  const contact: Contact = {
    id: Crypto.randomUUID(),
    label: label.trim(),
    address: address.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...contacts, contact];
  await saveContacts(next);
  return next;
}

export async function removeContact(id: string): Promise<Contact[]> {
  const contacts = await loadContacts();
  const next = contacts.filter((c) => c.id !== id);
  await saveContacts(next);
  return next;
}
