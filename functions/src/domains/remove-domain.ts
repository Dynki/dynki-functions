import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 
import * as Stripe from 'stripe';

const stripe = Stripe(functions.config().stripe.testkey);

exports.removeDomain = functions.auth.user().onDelete(async (user) => {
    try {
        const batch = admin.firestore().batch();

        // Get the correct user-domains document.
        const userDomainSnapshot = await admin.firestore().collection('user-domains').where('owner', '==', user.uid).get();
        const docId = userDomainSnapshot.docs[0].id;

        const stripeCustomerDocRef = await admin.firestore().collection('stripe_customers').doc(user.uid).get();
        const stripeCustomer = stripeCustomerDocRef.data();

        // Find the correct 'domains' document and add it to the batch for deletion.
        const messagesSnapShot = await admin.firestore().collection('domains').doc(docId).collection('users').doc(user.uid).collection('messages').get();
        for(const msgDoc of messagesSnapShot.docs) {
            // msgDoc.ref.delete();
            batch.delete(msgDoc.ref);
        }

        const domainUsersRef = admin.firestore().collection('domains').doc(docId).collection('users').doc(user.uid);
        batch.delete(domainUsersRef);

        // Find the correct 'domains' document and add it to the batch for deletion.
        const userSnapShot = await admin.firestore().collection('domains').doc(docId).collection('users').get();
        for(const userDoc of userSnapShot.docs) {
            // userDoc.ref.delete();
            batch.delete(userDoc.ref);
        }
    
        // Find the correct 'boardsInDomain' document and add it to the batch for deletion.
        const bidSnapshot = await admin.firestore().collection('domains').doc(docId).collection('boardsInDomain').get();
        for(const bidDoc of bidSnapshot.docs) {
            batch.delete(bidDoc.ref);
        }

        // Find the correct 'boards' document and add it to the batch for deletion.
        const boardsSnapshot = await admin.firestore().collection('domains').doc(docId).collection('boards').get();
        for(const boardsDoc of boardsSnapshot.docs) {
            boardsDoc.ref.delete();
        }

        batch.delete(admin.firestore().collection('domains').doc(docId));

        // Add the 'user-domains' document to the batch for deletion.
        batch.delete(admin.firestore().collection('user-domains').doc(docId).collection('subscriptions').doc('subscription'));
        batch.delete(userDomainSnapshot.docs[0].ref);
        await stripe.customers.del(stripeCustomer.customer_id);
        batch.delete(admin.firestore().collection('stripe_cusomers').doc(user.uid));

        await batch.commit();

    } catch (error) {
        console.log(error);
    }
});
