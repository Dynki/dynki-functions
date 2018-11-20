import { Express, Request, Response } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

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
                    res.json({ id: domainCollection.docs[0].id, display_name: domainCollection.docs[0].data().display_name });
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

    async post(req: Request, res: Response) {
        try {
            const domainCollection = await admin.firestore()
            .collection('user-domains').where('users', 'array-contains', req.headers.uid).get();

            const re = RegExp('^[0-9a-zA-Z \b]+$');
            if ((!domainCollection || domainCollection.docs.length === 0) && re.test(req.body.name)) {
                const domainRecord = {
                    name: req.body.name.toLocaleLowerCase(),
                    display_name: req.body.name,
                    owner: req.body.uid,
                    admins: [req.body.uid],
                    users: [req.body.uid]
                }

                const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
                const doc = await admin.firestore().collection('user-domains').doc(docRef.id).get();
                await admin.firestore().collection('domains').doc(docRef.id).set({ display_name: req.body.name });
                await admin.auth().setCustomUserClaims(req.body.uid, {domainId: docRef.id});

                res.json({ id: doc.data().id });
            } else {
                if (re.test(req.body.name)) {
                    res.status(403).send();
                } else {
                    res.status(406).send();
                }
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
