import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';

export const getUserDomain = functions.https.onRequest((request, response) => {
    firestore().collection('domains').get()
});