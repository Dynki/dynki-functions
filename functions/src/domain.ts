import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { authCheck } from './auth/checkAuthToken';
import * as cors from 'cors';
const corsHandler = cors({ origin: true });

export const getUserDomain = functions.https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
        try {
            await authCheck(req, res);
            const domain = await firestore().collection('user-domains').where('users', 'array-contains', req.body.uid).get();
            domain && domain.docs.length > 0 ? res.send(domain.docs[0].id) : res.status(404).send();
        } catch (error) {
            res.status(500).send({ error });
        }
    });
});

export const createUserDomain = functions.https.onRequest(async (req, res) => {
    try {
        corsHandler(req, res, () => req);
        await authCheck(req, res);
        const docRef = await firestore().collection('user-domains').add({ 'name': req.body.name, users: [req.body.uid] });
        const doc = await firestore().collection('user-domains').doc(docRef.id).get();
        res.send(doc.data());
    } catch (error) {
        res.status(500).send({ error });
    }
});
