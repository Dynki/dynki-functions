import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import * as domainFunctions from './domain';

admin.initializeApp();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

export const getUserDomain = domainFunctions.getUserDomain;
export const createUserDomain = domainFunctions.createUserDomain;