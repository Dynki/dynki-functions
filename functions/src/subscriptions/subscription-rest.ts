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

                    const subData = subsSnapshot.data();

                    let paymentMethods = await stripe.paymentMethods.list({
                        customer: subData.customer,
                        type: 'card'
                    });

                    if (paymentMethods && paymentMethods.data.length > 0) {
                        paymentMethods = paymentMethods.data.map(pm => {
                            return {
                                id: pm.id,
                                brand: pm.card.brand,
                                last4: pm.card.last4,
                                exp_month: pm.card.exp_month,
                                exp_year: pm.card.exp_year
                            }
                        });
                    } else {
                        paymentMethods = [];
                    }

                    let invoices = await stripe.invoices.list({
                        customer: subData.customer
                    });

                    if (invoices && invoices.data.length > 0) {
                        invoices = invoices.data.map(i => {
                            return {
                                id: i.id,
                                billing_reason: i.billing_reason,
                                description: i.description,
                                amount_due: i.amount_due,
                                amount_paid: i.amount_paid,
                                amount_remaining: i.amount_remaining,
                                due_date: i.due_date,
                                paid: i.paid,
                                next_payment_attempt: i.next_payment_attempt,
                                subtotal: i.subtotal,
                                tax: i.tax,
                                tax_percent: i.tax_percent,

                                lines: i.lines.data.map(l => {
                                    return {
                                        id: l.id,
                                        amount: l.amount,
                                        currency: l.currency,
                                        description: l.description,
                                        quantity: l.quantity,
                                        tax_amounts: l.tax_amounts,
                                        tax_percent: l.tax_percent
                                    }
                                })
                            }
                        });
                    } else {
                        invoices = [];
                    }


                    const mappedData = {
                        id: subData.id,
                        nickname: subData.items.data[0].plan.nickname, 
                        quantity: subData.items.data[0].quantity,
                        amount: subData.items.data[0].plan.amount,
                        tax_percent: subData.tax_percent,
                        currency: subData.items.data[0].plan.currency, 
                        interval: subData.items.data[0].plan.interval, 
                        status: subData.status,
                        trial_end: subData.trial_end,
                        next_invoice: subData.next_pending_invoice_item_invoice,
                        paymentMethods,
                        invoices
                    }

                    // This is the item we will expose in the response.
                    req.body.dynki.data.subscriptionRecord = mappedData;
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
                        const subData = await stripe.subscriptions.create(
                            {
                                customer: customerData.customer_id,
                                items: [{plan: plans['business']}],
                                trial_period_days: 30
                            }
                        );

                        const visibleSubscriptionInfo = {
                            id: subData.id,
                            nickname: subData.items.data[0].plan.nickname, 
                            quantity: subData.items.data[0].quantity,
                            amount: subData.items.data[0].plan.amount,
                            tax_percent: subData.tax_percent,
                            currency: subData.items.data[0].plan.currency, 
                            interval: subData.items.data[0].plan.interval, 
                            status: subData.status,
                            trial_end: subData.trial_end,
                            next_invoice: subData.next_pending_invoice_item_invoice
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
                            .set(subData);

                        await admin.firestore()
                            .collection('domains')
                            .doc(domainCollection.docs[0].id)
                            .update({ status: subData.status, subscription: visibleSubscriptionInfo });

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
                // const subscription = await stripe.subscriptions.put()
                // );

            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

}
