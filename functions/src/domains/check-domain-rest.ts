import { Express, Request, Response } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';

export class CheckDomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
    }

    async get(req: Request, res: Response) {
        try {
            const domainCollection = await admin.firestore()
                .collection('user-domains').select('name').get();

            if (domainCollection && domainCollection.docs.length > 0) {
                res.json({ id: domainCollection.docs[0].id });
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    // async getId(req: Request, res: Response) {
    //     try {
    //         console.log(req.headers);
    //         if (_.has(req, 'headers.domainName')) {
    //             const domainCollection = await admin.firestore()
    //                 .collection('user-domains').where('name', '==', req.headers.domainName).get();

    //             if (domainCollection && domainCollection.docs.length > 0) {
    //                 console.log('Domain::Send::', { id: domainCollection.docs[0].id });
    //                 res.json({ id: domainCollection.docs[0].id });
    //             } else {
    //                 res.status(404).send();
    //             } 
    //         } else {
    //             res.status(404).send();
    //         }
    //     } catch (error) {
    //         console.log(error);
    //         res.status(500).send({ error });
    //     }
    // }
}
