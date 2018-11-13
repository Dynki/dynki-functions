import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin'; 

export const assignDomain = functions.pubsub.topic('assign-domain').onPublish((msg) => {
    admin.auth().setCustomUserClaims(msg.json.uid, {domainId: msg.json.domainId}).then(() => {
        // The new custom claims will propagate to the user's ID token the
        // next time a new one is issued.
    });
});



