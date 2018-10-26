import { Express, Request, Response } from 'express';
import { firestore } from 'firebase-admin';
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
                const domainCollection = await firestore()
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
}

// export const getUserDomain = async (req: express.Request, res) => {
//     try {
//         console.log(req.headers);
//         if (_.has(req, 'headers.uid')) {
//             const domainCollection = await firestore().collection('user-domains').where('users', 'array-contains', req.headers.uid).get();
//             domainCollection && domainCollection.docs.length > 0 ? res.send({ id: domainCollection.docs[0].id }) : res.status(404).send();
//         } else {
//             res.status(404).send();
//         }
//     } catch (error) {
//         console.log(error);
//         res.status(500).send({ error });
//     }
// };

// export const createUserDomain = async (req, res) => {
//     try {
//         const docRef = await firestore().collection('user-domains').add({ 'name': req.body.name, users: [req.body.uid] });
//         const doc = await firestore().collection('user-domains').doc(docRef.id).get();
//         res.send(doc.data());
//     } catch (error) {
//         console.log(error);
//         res.status(500).send({ error });
//     }
// };

