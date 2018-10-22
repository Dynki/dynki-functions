import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';

export const getUserDomain = functions.https.onRequest((request, response) => {
    response.write(firestore().collection('user-domains').doc(request.body.uid));
});

export const createUserDomain = functions.https.onRequest((request, response) => {

    firestore().collection('user-domains')
    .add({ 'name': request.body.name, users: [request.body.uid] })
    .then(d => 
        firestore().collection('user-domains')
        .doc(d.id).get()
        .then(r => response.send(r.data))
        .catch(e => response.status(500).send({ error: 'Failed to create user domain' }))
    )
    .catch(e => response.status(500).send({ error: 'Failed to add user domain' }));
});