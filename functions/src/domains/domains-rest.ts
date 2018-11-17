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
                    res.json({ id: domainCollection.docs[0].id });
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
            console.log('Domain::Post::Start');
            const domainCollection = await admin.firestore()
            .collection('user-domains').where('users', 'array-contains', req.headers.uid).get();

            console.log('Domain::Post::1');
            const re = RegExp('^[0-9a-zA-Z \b]+$');
            if ((!domainCollection || domainCollection.docs.length === 0) && re.test(req.body.name)) {
                console.log('Domain::Post::2');
                const domainRecord = {
                    name: req.body.name,
                    display_name: req.body.name.toLocaleLowerCase(),
                    owner: req.body.uid,
                    admins: [req.body.uid],
                    users: [req.body.uid]
                }

                console.log('Domain::Post::3');
                const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
                console.log('Domain::Post::3a');
                const doc = await admin.firestore().collection('user-domains').doc(docRef.id).get();
                console.log('Domain::Post::3b');
                await admin.messaging().sendToTopic('assign-domain', { data: { uid: req.body.uid, domainId: doc.id } });
                console.log('Domain::Post::4');
                res.json({ id: doc.data().id });
            } else {
                console.log('Domain::Post::5');

                if (re.test(req.body.name)) {
                    res.status(403).send();
                } else {
                    res.status(406).send();
                }
                console.log('Domain::Post::6');

            }
        } catch (error) {
            console.log('Domain::Post::Error');

            console.log(error);
            res.status(500).send({ error });
        }
    }
}
