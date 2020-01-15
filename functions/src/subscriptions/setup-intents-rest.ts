import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';
import { subscriptionRest } from './subscription';

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

                        // Get the subscription document for this domain.
                        const subsSnapshot = await admin.firestore()
                            .collection('user-domains')
                            .doc(user.uid)
                            .collection('subscriptions')
                            .doc('subscription')
                            .get();

                        if (subsSnapshot.exists) {
                            const subSnapshotData = subsSnapshot.data();

                            const subResp = await stripe.subscriptions
                                                    .retrieve(subSnapshotData.id, 
                                                        { expand: ['latest_invoice.payment_intent', 'pending_setup_intent'] 
                                                    });

                            let createAnIntent;
                            switch (subResp.status) {
                                case 'active':
                                    createAnIntent = true;
                                    break;
                                case 'trialing':
                                    createAnIntent = true;
                                    break;
                                case 'unpaid':
                                    createAnIntent = false;
                                    break;
                                case 'past_due':
                                    createAnIntent = false;
                                    break;
                                case 'incomplete':
                                    createAnIntent = false;
                                    break;
                                case 'incomplete_expired':
                                    createAnIntent = false;
                                    break;
                                case 'canceled':
                                    createAnIntent = false;
                                    break;
                                default:
                                    createAnIntent = true;
                                    break
                            }

                            if (createAnIntent) {
                                const setupIntent = await stripe.setupIntents.create(
                                    {
                                        customer: customerData.customer_id,
                                        payment_method: paymentMethodId
                                    }
                                );
    
                                res.json({ client_secret: setupIntent.client_secret });
    
                            } else {
                                const { customer, latest_invoice } = subResp;
                                const { quantity } = subResp.items.data[0];
                                let { amount, currency, nickname } = subResp.items.data[0].plan;

                                if (latest_invoice && latest_invoice.billing_reason !== 'subscription_create' && latest_invoice.amount) {
                                    amount =  subResp.latest_invoice.amount;
                                    currency = subResp.latest_invoice.currency;
                                } else {
                                    amount = amount * quantity;
                                }
                                
                                const paymentIntent = await stripe.paymentIntents.create(
                                    {
                                        customer,
                                        description: nickname,
                                        payment_method_types: ['card'],
                                        payment_method: paymentMethodId,
                                        amount,
                                        currency    
                                    }
                                );
    
                                res.json({ client_secret: paymentIntent.client_secret });
                            }
                            
                        } else {
                            res.status(400).send('Could not locate subscription for customer');
                        }

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
