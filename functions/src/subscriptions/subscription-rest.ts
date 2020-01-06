import { Express, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';
import { SubscriptionRequest } from '../base/subscription-request';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class SubscriptionRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
    }

    async post(req: SubscriptionRequest, res: Response) {
        try {
            const { user } = req.body.dynki;

            const plans = { 
                personal: 'plan_GOBvycKRzKPWQu',
                business: 'plan_GOBx0tUX4ddXFl'
            }

            // Check that a valid plan has been supplied.
            if (plans[req.body.dynki.data.plan] === undefined) {
                res.status(500).send({ error: 'Invalid plan provided' });    
            } else {
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
                        const subscription = await stripe.subscriptions.create(
                            {
                                customer: customerData.customer_id,
                                items: [{plan: plans[req.body.dynki.data.plan]}],
                            }
                        );
                        
                        await admin.firestore()
                            .collection('user-domains')
                            .doc(domainCollection.docs[0].id)
                            .set({ subscription: subscription });
                    } else {
                        res.status(401).send('Unauthorised to perform this operation');
                    }
                } else {
                    res.status(401).send('Unauthorised to perform this operation');
                }
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
