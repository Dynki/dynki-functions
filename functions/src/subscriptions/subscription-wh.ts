import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as Stripe from 'stripe';
import * as express from 'express';
import * as cors from 'cors';

const stripe = Stripe(functions.config().stripe.testkey);
const endpointSecret = functions.config().stripe.subscriptionepsecret;
const app = express();

// Automatically allow cross-origin requests
app.use(cors({ origin: true }));
// app.use(bodyParser.raw({type: "*/*"}));

const processRequest = async (request, response) => {
    const sig = request.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.rawBody, sig, endpointSecret);

        // Handle the event
        switch (event.type) {
            case 'customer.subscription.updated':
                const subscription = event.data.object;

                // Get Stripe customer id from 'stripe_customers' collection.
                const stripeCustomersCollection = await admin.firestore()
                                                .collection('stripe_customers')
                                                .where('customer_id', '==', subscription.customer)
                                                .get();

                if (stripeCustomersCollection && stripeCustomersCollection.docs.length > 0) {
                    const stripeCustomerDoc = stripeCustomersCollection.docs[0].data();
                    const dynkiCustomerId = stripeCustomersCollection.docs[0].id;

                    // Get the subscription document for this domain.
                    const subsDoc = await admin.firestore()
                        .collection('user-domains')
                        .doc(dynkiCustomerId)
                        .collection('subscriptions')
                        .doc('subscription')
                        .get();

                    const domainDoc = await admin.firestore()
                        .collection('domains')
                        .doc(dynkiCustomerId)
                        .get();

                    if (subsDoc.exists && domainDoc.exists) {
                        await admin.firestore()
                                .collection('domains')
                                .doc(dynkiCustomerId)
                                .update({ status: subscription.status });

                        await admin.firestore()
                                .collection('user-domains')
                                .doc(dynkiCustomerId)
                                .collection('subscriptions')
                                .doc('subscription')
                                .update(subscription);

                    } else {
                        return response.status(400).send();
                    }

                } else {
                    return response.status(400).send();
                }

                break;
            default:
                // Unexpected event type
                return response.status(400).send();
        }
    }
    catch (err) {
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Return a response to acknowledge receipt of the event
    response.json({ received: true });
};

app.post('/', processRequest);

export const SubscriptionUpdateWebHook = functions.https.onRequest(app);
