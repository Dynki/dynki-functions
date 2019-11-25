import { Express, Request } from 'express';
import * as admin from 'firebase-admin'; 

import { DynRestBase } from '../base/restbase';

export class CheckDomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
    }

    async getId(req: Request, res: any, next, id) {
        try {
            const domainCollection = await admin.firestore()
                .collection('user-domains').where('name', '==', id.toLocaleLowerCase()).select('name').get();

            if (!domainCollection || domainCollection.docs.length === 0) {
                res.id = { resource: 'unique'};
                next();
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnId(req: Request, res: any) {
        try {
            res.json(res.id);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

}
