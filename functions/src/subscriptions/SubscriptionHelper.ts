import * as admin from 'firebase-admin';
import { Subscription } from 'stripe';
import { UserRecord } from 'firebase-functions/lib/providers/auth';

const functions = require('firebase-functions');
const stripe = require('stripe')(functions.config().stripe.testkey);

class SubscriptionHelper {

    plans = {
        business: 'plan_GcS4hwwlJJaOX1',
        businessUSD: 'plan_GcS46oKOyT89OF'
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

    private async getUserDomain(uid): Promise<Subscription> {
        // Get the subscription document for this domain.
        const subsSnapshot = await admin.firestore()
            .collection('user-domains')
            .doc(uid)
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
                    amount: subResp.items.data[0].plan.amount,
                    billing_cycle_anchor: subResp.billing_cycle_anchor,
                    cancel_at: subResp.cancel_at,
                    cancel_at_period_end: subResp.cancel_at_period_end,
                    canceled_at: subResp.canceled_at,
                    cost,
                    cost_tax,
                    currency: subResp.items.data[0].plan.currency,
                    customer,
                    default_payment_method: subResp.default_payment_method,
                    ended_at: subResp.ended_at,
                    interval: subResp.items.data[0].plan.interval,
                    invoices,
                    items: subResp.items,
                    latest_invoice: subResp.latest_invoice,
                    next_invoice: subResp.next_pending_invoice_item_invoice,
                    next_invoice_due: subResp.current_period_end ? subResp.current_period_end : subResp.trial_end,
                    nickname: subResp.items.data[0].plan.nickname,
                    paymentMethods,
                    quantity: subResp.items.data[0].quantity,
                    status: subResp.status,
                    tax_percent: subResp.tax_percent,
                    trial_end: subResp.trial_end,
                    trial_start: subResp.trial_start
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
                    amount_due: i.amount_due / 100,
                    amount_paid: i.amount_paid / 100,
                    amount_remaining: i.amount_remaining / 100,
                    billing_reason: i.billing_reason,
                    created: i.created,
                    currency: i.currency ? i.currency.toLocaleUpperCase() : i.currency,
                    description: i.description,
                    hosted_invoice_url: i.hosted_invoice_url,
                    invoice_pdf: i.invoice_pdf,
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
                    }),
                    next_payment_attempt: i.next_payment_attempt,
                    paid: i.paid,
                    status: i.status,
                    subtotal: i.subtotal / 100,
                    tax: i.tax / 100,
                    tax_percent: i.tax_percent
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
        const stripeCustomersRef = admin.firestore().collection('stripe_customers').doc(user.uid);
        const customerSnapshot = await stripeCustomersRef.get();
        const customerData = customerSnapshot.data();

        return customerData;
    }

    async createStripeCustomer(email: string, countryCode: string, region: string, VATNumber: string) {
        try {
            let tax_exempt = 'none';
    
            if (countryCode !== 'GB' && region === 'Europe' && VATNumber && VATNumber !== '') {
                tax_exempt = 'reverse';
            }
    
            const customer = await stripe.customers.create({ 
                email: email, 
                metadata: { country_code: countryCode, region, vat_number: VATNumber },
                tax_exempt            
            });
    
            if (VATNumber) {
                await stripe.customers.createTaxId(customer.id,
                    { type: 'eu_vat', value: VATNumber }
                )
            }
    
            return customer;
        } catch (error) {
            console.log('ERROR: creating Stripe customer:', error);
            return error;            
        }
    }

    async addSubscriptionForUser(user: UserRecord, countryCode: string, region: string, VATNumber: string, existingCustomerId = '', quantity = 1) {
        try {

            const planCode = countryCode === 'GB' ? this.plans.business : this.plans.businessUSD;

            if (await this.checkIsOwner(user.uid)) {

                let customerId;
                let existingCustomerFlag = false;

                if (!existingCustomerId || existingCustomerId === '') {
                    existingCustomerFlag = false;
                    const customer = await this.createStripeCustomer(user.email, countryCode, region, VATNumber);
                    customerId = customer.id;

                    await this.setStripeCustomerData(user, customerId);
                } else {
                    existingCustomerFlag = true;
                    customerId = existingCustomerId;
                }

                const customerData = await this.getStripeCustomerData(user);
                const subData = await this.createNewStripeSubscription(customerId, planCode, countryCode, region, existingCustomerFlag, quantity);
                await this.updateSubscriptionInformationForUser(user, subData);

                return subData;
            } else {
                throw new Error('Unauthorised to perform this operation - not the owner');
            }
        } catch (error) {
            return error;
        }
    }

    private async createNewStripeSubscription(customerId, planId, countryCode, region, existingCustomerFlag = false, quantity = 1) {

        const trial_period_days = existingCustomerFlag ? 0 : 30;

        // Create stripe subscription
        const subData = await stripe.subscriptions.create(
            {
                customer: customerId,
                items: [{
                    plan: planId,
                    quantity,
                    // Add VAT if GB country code.
                    tax_rates: region === 'Europe' ? ['txr_1G5DBPAySKreSZe2oH7uceaS'] : []
                }],
                trial_period_days,
                default_tax_rates: region === 'Europe' ? ['txr_1G5DBPAySKreSZe2oH7uceaS'] : []
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

            /**
             * Remove pending invoice items and clear usage
             * https://stripe.com/docs/billing/subscriptions/canceling-pausing
             */
            const invoiceItems = await stripe.invoiceItems.list({ 
                customer: subData.customer.id,
                pending: true
            });

            invoiceItems.data.map(async i => {
                await stripe.subscriptionItems.del(i.id);
            });

            let updatedSubData;
            if (subData.status === 'active') {
                updatedSubData = await stripe.subscriptions.update(subData.id, { cancel_at_period_end: true });
            } else {
                updatedSubData = await stripe.subscriptions.del(subData.id);

                if (subData.status === 'trialing') {
                    // Cancelling a trial so remove all the users. 
                    await this.removeAllMembersFromDomain(user);
                }
            }
    
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

            let subResp = await stripe.subscriptions
                .retrieve(subData.id, {
                    expand: ['customer', 'latest_invoice.payment_intent', 'pending_setup_intent']
                });
        
            const customerData = subResp.customer;

            if (subResp.status === 'canceled') {

                // Adding another subscription automatically charges the customer 
                // because a default payment method has already been attached.

                subResp = await this.addSubscriptionForUser(
                    user,
                    customerData.metadata.country_code,
                    customerData.metadata.region,
                    customerData.metadata.vat_number,
                    customerData.id
                );

                subResp = await stripe.subscriptions
                .retrieve(subResp.id, {
                    expand: ['customer', 'latest_invoice.payment_intent', 'pending_setup_intent']
                });

                return { client_secret: null, subscription: subResp };
                
            } else {

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
                    default:
                        createAnIntent = true;
                        break
                }
    
                if (createAnIntent) {
                    const setupIntent = await stripe.setupIntents.create(
                        {
                            customer: customerData.id,
                            payment_method: paymentMethodId
                        }
                    );
    
                    return { client_secret: setupIntent.client_secret, subscription: subResp };
    
                } else {
                    const { customer, latest_invoice } = subResp;
                    const { quantity } = subResp.items.data[0];
                    let { amount, currency } = subResp.items.data[0].plan;
                    const { nickname } = subResp.items.data[0].plan;
    
                    if (latest_invoice && latest_invoice.billing_reason !== 'subscription_create' && latest_invoice.amount) {
                        amount = subResp.latest_invoice.amount;
                        currency = subResp.latest_invoice.currency;
                    } else {
                        amount = amount * quantity;
                    }
    
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
    
                    return { client_secret: paymentIntent.client_secret, subscription: subResp };
                }
            }
        } else {
            throw new Error('Unauthorised to perform this operation - not the owner');
        }
    }

    async reactivateSubscriptionForUser(user: UserRecord) {
        try {

            if (await this.checkIsOwner(user.uid)) {

                const subData = await this.getSubscriptionForUser(user.uid);

                if (subData.status === 'active' && subData.cancel_at_period_end === true) {
                    await stripe.subscriptions.update(subData.id, { cancel_at_period_end: false });

                } else {
                    throw new Error('Cannot reactive this subscription');
                }

            } else {
                throw new Error('Unauthorised to perform this operation - not the owner');
            }
        } catch (error) {
            return error;
        }
    }

    async increaseSubscriptionQuantity(uid, increaseBy = 1) {
        try {
            const subData = await this.getSubscriptionForUser(uid);
            const quantity = subData.quantity + increaseBy;
            await stripe.subscriptions.update(subData.id, { quantity });

        } catch (error) {
            return error;
        }
    }

    async decreaseSubscriptionQuantity(uid, increaseBy = 1) {
        try {
            const subData = await this.getSubscriptionForUser(uid);
            let quantity = subData.quantity - increaseBy;
            quantity  = quantity < 1 ? 1 : quantity;
            await stripe.subscriptions.update(subData.id, { quantity });

        } catch (error) {
            return error;
        }
    }

    async removeAllMembersFromDomain(user: UserRecord) {
        const currentDomainData = await this.getUserDomain(user.uid);

        // Loop through all the members (who are not the owner) of the domain, 
        // and remove the permission to the domain from each users custom claims token.
        currentDomainData.members.map(async m => {

            if (m.uid !== user.uid) {
                const userMember: UserRecord = await admin.auth().getUser(m.uid);
    
                const claims = <any> userMember.customClaims;
                const primaryDomain = claims.domainId;
                const currentDomainIds = claims.domainIds;
    
                delete currentDomainIds[user.uid];
    
                await admin.auth().setCustomUserClaims(userMember.uid, { domainId: primaryDomain, domainIds: currentDomainIds });
            }

            return m;
        })

        // Remove the user from the members array  on the domain.
        await admin.firestore()
            .collection('user-domains')
            .doc(user.uid)
            .update({ members: currentDomainData.members.filter(m => m.uid === user.uid) });
    }
}

export default SubscriptionHelper;
