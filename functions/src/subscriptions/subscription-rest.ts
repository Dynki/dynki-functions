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

    async post(req: Request, res: Response) {
        try {
            const { user } = req.body.dynki;

            const plans = { 
                personal: 'plan_GOBvycKRzKPWQu',
                business: 'plan_GOBx0tUX4ddXFl'
            }

            // Check that a valid plan has been supplied.
            if (plans[req.body.plan] === undefined) {
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
                                items: [{plan: plans[req.body.plan]}],
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
}
