import * as admin from 'firebase-admin';
import { Subscription } from 'stripe';
import { subscription } from './subscription';
import { UserRecord } from 'firebase-functions/lib/providers/auth';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

class SubscriptionHelper {

    plans = {
        business: 'plan_GOBx0tUX4ddXFl'
    }

    private async getUserSubscription(uid): Promise<Subscription> {
        // Get the subscription document for this domain.
        const subsSnapshot = await admin.firestore()
            .collection('user-domains')
            .doc(uid)
            .collection('subscriptions')
            .doc('subscription')
            .get();

        return subsSnapshot.data();
    }

    private async checkIsOwner(uid) :  Promise<boolean> {
        try {
            // Check if user is owner of the domain.
            const domainCollection = await admin.firestore()
                .collection('user-domains')
                .where('owner', '==', uid)
                .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const userDomains = domainCollection.docs[0].data();

                if (userDomains.owner === uid) {
                    return true;
                } else {
                    return false;
                }
            } else {
                return false;
            }

        } catch (error) {
            return error;
        }
    }

    async getSubscriptionForUser(uid) {
        try {

            if (await this.checkIsOwner(uid)) {
                const subData = await this.getUserSubscription(uid);

                const customer = await stripe.customers.retrieve(subData.customer, {
                    expand: ['invoice_settings.default_payment_method']
                });

                const paymentMethods = await this.getPaymentMethods(subData, customer);
                const invoices = await this.getInvoices(subData);


                const subResp = await stripe.subscriptions.retrieve(subData.id, { expand: ['latest_invoice.payment_intent', 'pending_setup_intent'] });

                const taxPercent = subResp.default_tax_rates && subResp.default_tax_rates.length > 0
                    ? subResp.default_tax_rates[0].percentage
                    : 0;

                const cost = subResp.quantity * subResp.plan.amount;
                const cost_tax = Math.round((cost / 100) * taxPercent);

                const mappedData = {
                    id: subData.id,
                    billing_cycle_anchor: subResp.billing_cycle_anchor,
                    cost,
                    cost_tax,
                    customer,
                    nickname: subResp.items.data[0].plan.nickname,
                    quantity: subResp.items.data[0].quantity,
                    amount: subResp.items.data[0].plan.amount,
                    tax_percent: subResp.tax_percent,
                    currency: subResp.items.data[0].plan.currency,
                    default_payment_method: subResp.default_payment_method,
                    interval: subResp.items.data[0].plan.interval,
                    status: subResp.status,
                    trial_start: subResp.trial_start,
                    trial_end: subResp.trial_end,
                    next_invoice: subResp.next_pending_invoice_item_invoice,
                    latest_invoice: subResp.latest_invoice,
                    invoices,
                    paymentMethods
                }

                return mappedData;

            } else {
                return new Error('Not owner of domain');
            }
        } catch (error) {
            return error;
        }
    }

    async getPaymentMethods(subData: Subscription, customer): Promise<Array<any>> {

        const defaultPaymentMethodId = customer &&
            customer.invoice_settings &&
            customer.invoice_settings.default_payment_method
            ?
            customer.invoice_settings.default_payment_method.id
            :
            null;

        let paymentMethods = await stripe.paymentMethods.list({
            customer: customer.id,
            type: 'card'
        });

        if (paymentMethods && paymentMethods.data.length > 0) {
            paymentMethods = paymentMethods.data.map(pm => {
                return {
                    id: pm.id,
                    brand: pm.card.brand,
                    last4: pm.card.last4,
                    exp_month: pm.card.exp_month,
                    exp_year: pm.card.exp_year,
                    default: pm.id === defaultPaymentMethodId ? 'Default' : ''
                }
            });
        } else {
            paymentMethods = [];
        }

        return paymentMethods;
    }

    async getInvoices(subData: Subscription): Promise<Array<any>> {
        let invoices = await stripe.invoices.list({
            customer: subData.customer
        });

        if (invoices && invoices.data.length > 0) {
            invoices = invoices.data.map(i => {
                return {
                    id: i.id,
                    created: i.created,
                    billing_reason: i.billing_reason,
                    description: i.description,
                    amount_due: i.amount_due / 100,
                    amount_paid: i.amount_paid / 100,
                    amount_remaining: i.amount_remaining / 100,
                    currency: i.currency ? i.currency.toLocaleUpperCase() : i.currency,
                    paid: i.paid,
                    status: i.status,
                    next_payment_attempt: i.next_payment_attempt,
                    subtotal: i.subtotal / 100,
                    tax: i.tax / 100,
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

        return invoices;
    }

    async setStripeCustomerData(user: UserRecord, customerId: string) {
        await admin.firestore().collection('stripe_customers').doc(user.uid).set({ customer_id: customerId });
    }

    async getStripeCustomerData(user: UserRecord) {
        // Set Stripe customer id from 'stripe_customers' collection.
        console.log('Getting stripe customer for user:', user.uid);
        const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
        const customerSnapshot = await stripeCustomersRef.get();
        const customerData = customerSnapshot.data();

        return customerData;
    }

    async createStripeCustomer(email, countryCode, VATNumber) {
        const customer = await stripe.customers.create({ 
            email: email, 
            metadata: { country_code: countryCode, vat_number: VATNumber } 
        });

        if (VATNumber) {
            await stripe.customer.createTaxId(customer.id,
                { type: 'eu_vat', value: VATNumber }
            )
        }

        return customer;
    }

    async addSubscriptionForUser(user: UserRecord, countryCode: string, VATNumber: string, existingCustomerId = '') {
        try {

            // Check that a valid plan has been supplied.
            if (this.plans['business'] === undefined) {
                throw new Error('Could not locate correct plan for subscription');
            } else {
                if (await this.checkIsOwner(user.uid)) {

                    let customerId;
                    let existingCustomerFlag = false;

                    if (!existingCustomerId || existingCustomerId === '') {
                        existingCustomerFlag = false;
                        const customer = await this.createStripeCustomer(user.email, countryCode, VATNumber);
                        customerId = customer.id;

                        await this.setStripeCustomerData(user, customerId);
                    } else {
                        existingCustomerFlag = true;
                        customerId = existingCustomerId;
                    }

                    const customerData = await this.getStripeCustomerData(user);

                    console.log('customerData: ', customerData);
                    console.log('customerId: ', customerId);

                    const subData = await this.createNewStripeSubscription(customerId, this.plans['business'], countryCode, existingCustomerFlag);
                    const visibleSubscriptionInfo = await this.updateSubscriptionInformationForUser(user, subData);

                    return visibleSubscriptionInfo;
                } else {
                    throw new Error('Unauthorised to perform this operation - not the owner');
                }
            }
        } catch (error) {
            return error;
        }
    }

    private async createNewStripeSubscription(customerId, planId, countryCode, existingCustomerFlag = false) {

        const trial_period_days = existingCustomerFlag ? 0 : 30;

        // Create stripe subscription
        const subData = await stripe.subscriptions.create(
            {
                customer: customerId,
                items: [{
                    plan: planId,
                    quantity: 1,
                    // Add VAT if GB country code.
                    tax_rates: countryCode === 'GB' ? ['txr_1FxsTKAySKreSZe26HNTl3eH'] : []
                }],
                trial_period_days,
                default_tax_rates: countryCode === 'GB' ? ['txr_1FxsTKAySKreSZe26HNTl3eH'] : []
            }
        );

        return subData;
    }

    async updateSubscriptionInformationForUser(user: UserRecord, subData: Subscription) {
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
            .doc(user.uid)
            .update({ subscriptionInfo: visibleSubscriptionInfo });

        await admin.firestore()
            .collection('user-domains')
            .doc(user.uid)
            .collection('subscriptions')
            .doc('subscription')
            .set(subData);

        await admin.firestore()
            .collection('domains')
            .doc(user.uid)
            .update({ status: subData.status, subscription: visibleSubscriptionInfo });

        return visibleSubscriptionInfo;
    }

    async cancelSubscriptionForUser(user: UserRecord) {
        if (await this.checkIsOwner(user.uid)) {
            const subData = await this.getSubscriptionForUser(user.uid);

            const invoiceItems = await stripe.invoiceItems.list({ 
                    customer: subData.customer.id,
                    pending: true
            });

            /**
             * Remove pending invoice items and clear usage
             * https://stripe.com/docs/billing/subscriptions/canceling-pausing
             */
            invoiceItems.data.map(async i => { await stripe.invoiceItems.del(i.id) });
            await stripe.subscriptions.update('sub_GZppnzttrkCEa5', { clear_usage: true });

            const updatedSubData = await stripe.subscriptions.del(subData.id);
            await this.updateSubscriptionInformationForUser(user, updatedSubData);

        } else {
            throw new Error('Not owner of domain');
        }
    }

    async createIntentForUser(user: UserRecord, paymentMethodId) {

        // Get Stripe customer id from 'stripe_customers' collection.
        // const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
        // const customerSnapshot = await stripeCustomersRef.get();
        // const customerData = customerSnapshot.data();
        if (!paymentMethodId) {
            throw new Error('Invalid payment method supplied');
        }

        // Check if user is owner of the domain.
        if (await this.checkIsOwner(user.uid)) {
            const subData = await this.getSubscriptionForUser(user.uid);

            const subResp = await stripe.subscriptions
                .retrieve(subData.id, {
                    expand: ['customer', 'latest_invoice.payment_intent', 'pending_setup_intent']
                });
        
            const customerData = subResp.customer;

            console.log('A');

            if (subResp.status === 'canceled') {
                await this.addSubscriptionForUser(
                    user,
                    customerData.metadata.country_code,
                    customerData.metadata.vat_number,
                    customerData.id
                );
            }

            console.log('B');

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
                console.log('C');
    
                const setupIntent = await stripe.setupIntents.create(
                    {
                        customer: customerData.id,
                        payment_method: paymentMethodId
                    }
                );

                console.log('D');

                return { client_secret: setupIntent.client_secret };

            } else {
                console.log('E');

                const { customer, latest_invoice } = subResp;
                const { quantity } = subResp.items.data[0];
                let { amount, currency, nickname } = subResp.items.data[0].plan;

                if (latest_invoice && latest_invoice.billing_reason !== 'subscription_create' && latest_invoice.amount) {
                    amount = subResp.latest_invoice.amount;
                    currency = subResp.latest_invoice.currency;
                } else {
                    amount = amount * quantity;
                }

                console.log('F');

                const paymentIntent = await stripe.paymentIntents.create(
                    {
                        customer: customer.id,
                        description: nickname,
                        payment_method_types: ['card'],
                        payment_method: paymentMethodId,
                        amount,
                        currency
                    }
                );

                console.log('G');

                return { client_secret: paymentIntent.client_secret };
            }

        } else {
            throw new Error('Unauthorised to perform this operation - not the owner');
        }
    }
}

export default SubscriptionHelper;