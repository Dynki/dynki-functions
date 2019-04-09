import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

exports.removeDomain = functions.auth.user().onDelete(async (user) => {
    try {
        // Get the correct user-domains document.
        const userDomainSnapshot = await admin.firestore().collection('user-domains').where('owner', '==', user.uid).get();
        const docId = userDomainSnapshot.docs[0].id;

        // Find the correct 'domains' document and add it to the batch for deletion.
        const messagesSnapShot = await admin.firestore().collection('domains').doc(docId).collection('users').doc(user.uid).collection('messages').get();

        for(const msgDoc of messagesSnapShot.docs) {
            msgDoc.ref.delete();
        }

        admin.firestore().collection('domains').doc(docId).collection('users').doc(user.uid).delete();

        // Find the correct 'domains' document and add it to the batch for deletion.
        const userSnapShot = await admin.firestore().collection('domains').doc(docId).collection('users').get();
        for(const userDoc of userSnapShot.docs) {
            userDoc.ref.delete();
        }
        
        // Find the correct 'boardsInDomain' document and add it to the batch for deletion.
        const bidSnapshot = await admin.firestore().collection('domains').doc(docId).collection('boardsInDomain').get();
        for(const bidDoc of bidSnapshot.docs) {
            bidDoc.ref.delete();
        }

        // Find the correct 'boards' document and add it to the batch for deletion.
        const boardsSnapshot = await admin.firestore().collection('domains').doc(docId).collection('boards').get();
        for(const boardsDoc of boardsSnapshot.docs) {
            boardsDoc.ref.delete();
        }

        admin.firestore().collection('domains').doc(docId).delete();

        // Add the 'user-domains' document to the batch for deletion.
        userDomainSnapshot.docs[0].ref.delete();
    } catch (error) {
        console.log(error);
    }
});
