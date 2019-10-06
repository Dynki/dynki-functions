import { Express, Request, Response } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';
import newGuid from '../utils/guid';

import { DynRestBase } from '../base/restbase';

export class DomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
    }

    async get(req: Request, res: Response) {
        try {
            console.log(req.headers);
            if (_.has(req, 'headers.uid')) {
                const domainCollection = await admin.firestore()
                    .collection('user-domains').where('users', 'array-contains', req.headers.uid).get();

                if (domainCollection && domainCollection.docs.length > 0) {
                    console.log('Domain::Send::', { id: domainCollection.docs[0].id });

                    const domains = domainCollection.docs.map(d => {
                        return { id: d.id, display_name: d.data().display_name  }
                    });

                    res.json({ domains });
                } else {
                    res.status(404).send();
                } 
            } else {
                res.status(404).send();
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getId(req: Request, res: Response, next, id) {
        try {
            if (_.has(req, 'headers.authorization')) {
                const token = req.headers.authorization;

                // Verify the ID token first.
                admin.auth().verifyIdToken(token).then(async (decodedToken) => {
                    const uid = decodedToken.uid;

                    const domainCollection = await admin.firestore()
                        .collection('user-domains')
                        .where(admin.firestore.FieldPath.documentId(), '==', id)
                        .where('users', 'array-contains', uid)
                        .get();
    
                    if (domainCollection && domainCollection.docs.length > 0) {
                        console.log('Domain::Send::', { id: domainCollection.docs[0].id });
                        req.body.record = domainCollection.docs[0];
                        next();
                        res.json({ id: domainCollection.docs[0].id, display_name: domainCollection.docs[0].data().display_name });
                    } else {
                        res.status(404).send();
                    } 
                }).catch(error => {
                    res.status(500).send('Error validating custom claims');
                });
            } else {
                res.status(404).send();
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnId(req: Request, res: Response) {
        try {
            res.json({ id: req.body.record.id, display_name: req.body.record.data() });
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: Request, res: Response) {
        try {
            const domainRecord = {
                name: newGuid(),
                display_name: req.body.name,
                owner: req.body.uid,
                admins: [req.body.uid],
                users: [req.body.uid]
            }

            const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
            const doc = await admin.firestore().collection('user-domains').doc(docRef.id).get();
            const domDoc = await admin.firestore().collection('domains').doc(docRef.id).set({display_name: req.body.name});
            admin.firestore().collection('domains').doc(docRef.id).collection('users').doc(req.body.uid).set({
                email: req.body.email,
                displayName: req.body.displayName,
            });
            
            admin.firestore()
            .collection('domains')
            .doc(docRef.id)
            .collection('users')
            .doc(req.body.uid)
            .collection('messages')
            .doc('initial')
            .set({
                id: 'initial',
                from: 'Dynki Team',
                to: [req.body.email],
                subject: 'Welcome to Dynki',
                body: {
                    ops: [
                    { insert: 'Hi, \n\n' +
                    'Thanks for choosing to give us a try. \n' +
                    'You can now start creating boards. \n\n' +
                    'Once again thanks for choosing us. \n\n' +
                    'Regards \n' },
                    { insert: 'Team Dynki', attributes: { bold: true } }
                ]},
                sent: true,
                created: new Date(),
                author: 'Dynki Team',
                status: 'Unread',
                read: false,
                reading: false,
                selected: false
            });

            await admin.auth().setCustomUserClaims(req.body.uid, {domainId: docRef.id});

            res.json({ id: doc.data().id });
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
