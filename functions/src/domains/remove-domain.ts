import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

exports.removeDomain = functions.auth.user().onDelete(async (user) => {
    try {
        console.log('On Delete::Start');
        // Create a batch to store all the records we wish to delete.

        console.log('On Delete::1');
        // Get the correct user-domains document.
        const userDomainSnapshot = await admin.firestore().collection('user-domains').where('owner', '==', user.uid).get();
        userDomainSnapshot.forEach(function wrapper(){async udDoc => {
            console.log('On Delete::2::uDoc.id::', udDoc.id);

            // Find the correct 'domains' document and add it to the batch for deletion.
            await admin.firestore().collection('domains').doc(udDoc.id).collection('users').get().then(userSnapShot => {
                console.log('On Delete::2a');
                userSnapShot.docs.forEach(userDoc => userDoc.ref.delete());
            });

            console.log('On Delete::3');

            // Find the correct 'boardsInDomain' document and add it to the batch for deletion.
            await admin.firestore().collection('domains').doc(udDoc.id).collection('boardsInDomain').get().then(bidSnapshot => {
                console.log('On Delete::2b');
                bidSnapshot.docs.forEach(bidDoc => bidDoc.ref.delete());
            });

            console.log('On Delete::4');

            // Find the correct 'boards' document and add it to the batch for deletion.
            await admin.firestore().collection('domains').doc(udDoc.id).collection('boards').get().then(boardsSnapshot => {
                console.log('On Delete::2c');
                boardsSnapshot.docs.forEach(boardsDoc => boardsDoc.ref.delete());
            });

            console.log('On Delete::5');

            // Add the 'user-domains' document to the batch for deletion.
            udDoc.ref.delete();

            console.log('On Delete::6');
            return true;
        }});

        console.log('On Delete::7');
    } catch (error) {
        console.log(error);
    }
});
