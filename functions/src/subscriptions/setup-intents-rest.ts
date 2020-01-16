import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';
import SubscriptionHelper from './SubscriptionHelper';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class SetupIntentsRest extends DynRestBase {
    helper: SubscriptionHelper;

    constructor(public domainApp: Express) {
        super(domainApp);
        this.helper = new SubscriptionHelper();
    }

    async post(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            const { paymentMethodId } = req.body;

            const secret = await this.helper.createIntentForUser(user, paymentMethodId);
            res.json(secret);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
