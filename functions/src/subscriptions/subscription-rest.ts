import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class SubscriptionRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);
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

            // Check if user is owner of the domain.
            const domainCollection = await admin.firestore()
            .collection('user-domains')
            .where('owner', '==', user.uid)
            .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const domainId = domainCollection.docs[0].id;

                // Get the subscription document for this domain.
                const subsSnapshot = await admin.firestore()
                .collection('user-domains')
                .doc(domainId)
                .collection('subscriptions')
                .doc('subscription')
                .get();

                if (subsSnapshot.exists) {
                    // This is the item we will expose in the response.
                    req.body.dynki.data.subscriptionRecord = subsSnapshot.data();
                    req.body.dynki.data.subscriptionId = subsSnapshot.id;
                    req.body.dynki.data.domainId = domainId;
                    req.body.dynki.data.domainRawRecord = domainCollection.docs[0].data();

                    next();
                } else {
                    res.status(404).send();
                }
            } else {
                res.status(403).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;

            const plans = { 
                business: 'plan_GOBx0tUX4ddXFl'
            }

            // Check that a valid plan has been supplied.
            if (plans['business'] === undefined) {
                res.status(500).send({ error: 'Invalid plan provided' });    
            } else {
                const customer = await stripe.customers.create({email: user.email});
                await admin.firestore().collection('stripe_customers').doc(user.uid).set({customer_id: customer.id});
            
                // Get Stripe customer id from 'stripe_customers' collection.
                console.log('Getting stripe customer for user:', user.uid);
                const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
                const customerSnapshot = await stripeCustomersRef.get();
                const customerData = customerSnapshot.data();

                console.log('customerData: ', customerData);
                
                // Check if user is owner of the domain.
                const domainCollection = await admin.firestore()
                    .collection('user-domains')
                    .where('owner', '==', user.uid)
                    .get();
                
                console.log('Domain collection docs length', domainCollection.docs.length);

                if (domainCollection && domainCollection.docs.length > 0) {
                    const userDomains = domainCollection.docs[0].data();
                    
                    console.log('UserDomains Data', userDomains);

                    if (userDomains.owner === user.uid) {
                        // Create stripe subscription
                        const subscription = await stripe.subscriptions.create(
                            {
                                customer: customerData.customer_id,
                                items: [{plan: plans['business']}],
                                trial_period_days: 30
                            }
                        );

                        const subscriptionData = subscription.plan;
                        const { nickname } = subscriptionData;
                        const { status, quantity } = subscription;

                        const visibleSubscriptionInfo = {
                            nickname,
                            quantity,
                            status
                        }
                        
                        await admin.firestore()
                            .collection('user-domains')
                            .doc(domainCollection.docs[0].id)
                            .update({ subscriptionInfo: visibleSubscriptionInfo });

                        await admin.firestore()
                            .collection('user-domains')
                            .doc(domainCollection.docs[0].id)
                            .collection('subscriptions')
                            .doc('subscription')
                            .set(subscription);

                        await admin.firestore()
                            .collection('domains')
                            .doc(domainCollection.docs[0].id)
                            .update({ status });

                        res.status(200).send();
                    } else {
                        res.status(401).send('Unauthorised to perform this operation - not the owner');
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
                const subscription = await stripe.subscriptions.put()
                );

            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

}
