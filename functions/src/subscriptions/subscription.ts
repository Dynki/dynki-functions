import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import { authCheck } from '../auth/checkAuthToken';

import { SubscriptionRest } from './subscription-rest';

const app = express();
app.use(cors({ origin: true }));
app.use(authCheck);

export const subscription = functions.https.onRequest((req, res) => {
    if (!req.path) {
        req.url = `/${req.url}` // prepend '/' to keep query params if any
    }
    return app(req, res);
});

export const subscriptionRest = new SubscriptionRest(app);

