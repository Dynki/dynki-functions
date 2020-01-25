import { Express, Request, Response } from 'express';

import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';
import SubscriptionHelper from './SubscriptionHelper';
import { subscription } from './subscription';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

export class PaymentMethodsRest extends DynRestBase {
    helper: SubscriptionHelper;

    constructor(public domainApp: Express) {
        super(domainApp);
        this.helper = new SubscriptionHelper();
    }

    async getId(req: Request, res: Response, next, id) {
        try {
            
            // More for internal use within these functions.
            req.body.dynki.data.paymentMethodId = id
            next();

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
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

                    const subData = await this.helper.getSubscriptionForUser(user.uid);

                    if (subData.cancel_at_period_end === true) {
                        await stripe.subscriptions.update(subData.id, { cancel_at_period_end: false });
                    }

                    if (paymentMethodId) {
                        await stripe.paymentMethods.attach(
                            paymentMethodId,
                            {
                                customer: customerData.customer_id,
                            }
                        );

                        await stripe.customers.update(
                            customerData.customer_id,
                            {
                              invoice_settings: {
                                default_payment_method: paymentMethodId,
                              }
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
            const { paymentMethodId } = req.body.dynki.data;

            // Get Stripe customer id from 'stripe_customers' collection.
            const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
            const customerSnapshot = await stripeCustomersRef.get();
            const customerData = customerSnapshot.data();

            /**
             * Actions: 
             */
            const { action } = req.body;

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

                        switch (action) {
                            case 'detach':
                                await stripe.paymentMethods.detach(paymentMethodId);

                                break;
                            case 'set_default':
                                await stripe.customers.update(
                                    customerData.customer_id,
                                    {
                                      invoice_settings: {
                                        default_payment_method: paymentMethodId,
                                      }
                                    }
                                );
                                    
                                break;
                            default:
                                res.status(400).send('Invalid payment method action supplied');        
                                break;
                        }

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

}
