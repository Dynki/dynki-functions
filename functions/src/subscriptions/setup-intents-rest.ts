import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class SetupIntentsRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
    }

    async post(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            const { paymentMethodId } = req.body;
        
            // Get Stripe customer id from 'stripe_customers' collection.
            const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
            const customerSnapshot = await stripeCustomersRef.get();
            const customerData = customerSnapshot.data();

            // Check if user is owner of the domain.
            const domainCollection = await admin.firestore()
                .collection('user-domains')
                .where('owner', '==', user.uid)
                .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const userDomains = domainCollection.docs[0].data();
                
                if (userDomains.owner === user.uid) {
                    // Create stripe subscription

                    if (paymentMethodId) {

                        const setupIntent = await stripe.setupIntents.create(
                            {
                                customer: customerData.customer_id,
                                payment_method: paymentMethodId
                            }
                        );

                        res.json({ client_secret: setupIntent.client_secret });
                    } else {
                        res.status(400).send('Invalid payment method supplied');
                    }
                } else {
                    res.status(401).send('Unauthorised to perform this operation - not the owner');
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
