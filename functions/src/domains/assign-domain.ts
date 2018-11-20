import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

export const assignDomain = functions.firestore
    .document('user-domains/{domainId}')
    .onUpdate((snap, context) => {
        // const newId = snap.id
        // const newUser = snap.data().users[0];
        // admin.auth().setCustomUserClaims(newUser, {domainId: newId}).then(() => {
        // The new custom claims will propagate to the user's ID token the
        // next time a new one is issued.
        // });
});



