import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

exports.removeDomain = functions.auth.user().onDelete(async (user) => {
    try {
        console.log('On Delete::Start');
        // Create a batch to store all the records we wish to delete.
        const batch = admin.firestore().batch();

        console.log('On Delete::1');
        // Get the correct user-domains document.
        const userDomainSnapshot = await admin.firestore().collection('user-domains').where('owner', '==', user.uid).get();
        userDomainSnapshot.forEach(async udDoc => {
            console.log('On Delete::2');

            // Find the correct 'domains' document and add it to the batch for deletion.
            const userSnapShot = await admin.firestore().collection('domains').doc(udDoc.id).collection('users').get();
            userSnapShot.forEach(userDoc => batch.delete(userDoc.ref));

            console.log('On Delete::3');

            // Find the correct 'boardsInDomain' document and add it to the batch for deletion.
            const bidSnapshot = await admin.firestore().collection('domains').doc(udDoc.id).collection('boardsInDomain').get();
            bidSnapshot.forEach(bidDoc => batch.delete(bidDoc.ref));

            console.log('On Delete::4');

            // Find the correct 'boards' document and add it to the batch for deletion.
            const boardsSnapshot = await admin.firestore().collection('domains').doc(udDoc.id).collection('boards').get();
            boardsSnapshot.forEach(boardsDoc => batch.delete(boardsDoc.ref));

            console.log('On Delete::5');

            // Add the 'user-domains' document to the batch for deletion.
            batch.delete(udDoc.ref);

            console.log('On Delete::6');
        });

        console.log('On Delete::7');

        batch.commit();

        console.log('On Delete::8');

    } catch (error) {
        console.log(error);
    }
});
