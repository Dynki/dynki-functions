import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';

export const getUserDomain = functions.https.onRequest((request, response) => {
    response.write(firestore().collection('user-domains').doc(request.body.uid));
});