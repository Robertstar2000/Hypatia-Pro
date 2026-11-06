// Durable, server-owned billing records. Browser Firestore rules must deny this collection.
export function firestoreBillingStore(firestore, product) {
  const root = firestore.collection('mifeco_billing_' + product.replace(/[^a-z0-9_]/g, '_'));
  const references = root.doc('records').collection('references');
  const subscriptions = root.doc('records').collection('subscriptions');
  return {
    async addReference(reference, userId) { await references.doc(reference).create({reference,user_id:userId,product,created_at:Date.now()}); },
    async getReference(reference) { if(typeof reference !== 'string' || !/^[a-f0-9]{48}$/.test(reference))return null; const doc=await references.doc(reference).get();return doc.exists?doc.data():null; },
    async addSubscription(row) {
      try { await subscriptions.doc(row.subscription_id).create(row); }
      catch(error) { if(error.code !== 6 && error.code !== 'already-exists')throw error; }
    },
    async getSubscription(id) { const doc=await subscriptions.doc(id).get();return doc.exists?doc.data():null; },
    async forUser(userId) { const rows=await subscriptions.where('user_id','==',userId).get();return rows.docs.map(doc=>doc.data()).filter(row=>row.product===product); },
  };
}

export async function defaultBillingStore(config, product) {
  const {getApps, initializeApp, applicationDefault}=await import('firebase-admin/app');
  const {getFirestore}=await import('firebase-admin/firestore');
  const name='mifeco-billing-store';
  const app=getApps().find(app=>app.name===name) || initializeApp({projectId:config.MIFECO_BILLING_PROJECT_ID,credential:applicationDefault()},name);
  return firestoreBillingStore(getFirestore(app,config.MIFECO_BILLING_DATABASE_ID || '(default)'),product);
}
