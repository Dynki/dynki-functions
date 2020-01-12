import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class PaymentMethodsRest extends DynRestBase {
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
                
                console.log('UserDomains Data', userDomains);

                if (userDomains.owner === user.uid) {
                    // Create stripe subscription

                    if (paymentMethodId) {
                        await stripe.paymentMethods.attach(
                            paymentMethodId,
                            {
                                customer: customerData.customer_id,
                            }
                        );

                        res.status(200).send();
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

    async put(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;
            const { domainRawRecord: domain, subscription } = req.body.dynki.data;
            const { action } = req.body;

            /**
             * Actions - SUB (Subscription Update) - UPGRADE | DOWNGRADE | CANCEL
             *           QTY (Quantity Update) - INCREMENT | DECREMENT
             */

            if (domain.owner === user.uid) {
                // const subscription = await stripe.subscriptions.put()
                // );

            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

}
