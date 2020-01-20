import { Express, Request, Response } from 'express';

import * as _ from 'lodash';
import SubscriptionHelper from './SubscriptionHelper';

import { DynRestBase } from '../base/restbase';

export class SubscriptionRest extends DynRestBase {
    helper: SubscriptionHelper;

    constructor(public domainApp: Express) {
        super(domainApp);
        this.helper = new SubscriptionHelper();
    }

    async returnId(req: Request, res: Response) {
        try {
            res.json(req.body.dynki.data.subscriptionRecord);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getId(req: Request, res: Response, next, id) {
        try {
            const { user } = req.body.dynki;

            const mappedData = await this.helper.getSubscriptionForUser(user.uid);

            // This is the item we will expose in the response.
            req.body.dynki.data.subscriptionRecord = mappedData;
            req.body.dynki.data.subscriptionId = mappedData.id;
            // req.body.dynki.data.domainId = domainId;
            // req.body.dynki.data.domainRawRecord = domainCollection.docs[0].data();

            next();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            const { countryCode, VATNumber } = req.body;
            const visibleSubscriptionInfo = await this.helper.addSubscriptionForUser(user, countryCode, VATNumber);

            res.json(visibleSubscriptionInfo);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async put(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            const { action } = req.body;

            if (action === 'reactivate') {
                await this.helper.reactivateSubscriptionForUser(user);
                res.status(200).send();
            } else {
                res.status(400).send({ error: 'Invalid action supplied' });
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async delete(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            await this.helper.cancelSubscriptionForUser(user);

            res.status(200).send();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
