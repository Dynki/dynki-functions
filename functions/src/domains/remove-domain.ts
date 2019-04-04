import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

exports.removeDomain = functions.auth.user().onDelete(async (user) => {
    try {
        // Create a batch to store all the records we wish to delete.
        const batch = admin.firestore().batch();

        // Get the correct user-domains document.
        const userDomainSnapshot = await admin.firestore().collection('user-domains').where('owner', '==', user.uid).get();
        userDomainSnapshot.forEach(async udDoc => {

            // Find the correct 'domains' document and add it to the batch for deletion.
            const domainsDocRef = await admin.firestore().collection('domains').doc(udDoc.id).get();
            const userSnapShot = domainsDocRef.data().collection('users').get();
            userSnapShot.forEach(userDoc => batch.delete(userDoc.ref));

            // Find the correct 'boardsInDomain' document and add it to the batch for deletion.
            const bidSnapshot = await domainsDocRef.data().collection('boardsInDomain').delete();
            bidSnapshot.forEach(bidDoc => batch.delete(bidDoc.ref));

            // Find the correct 'boards' document and add it to the batch for deletion.
            const boardsSnapshot = await domainsDocRef.data().collection('boards').delete();
            boardsSnapshot.forEach(boardsDoc => batch.delete(boardsDoc.ref));

            // Add the 'user-domains' document to the batch for deletion.
            batch.delete(udDoc.ref);
        });

        batch.commit();
    } catch (error) {
        console.log(error);
    }
});
