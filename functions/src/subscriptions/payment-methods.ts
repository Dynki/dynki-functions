import * as functions from 'firebase-functions';
import * as express from 'express';
import * as cors from 'cors';
import { authCheck } from '../auth/checkAuthToken';

import { PaymentMethodsRest } from './payment-methods-rest';

const app = express();
app.use(cors({ origin: true }));
app.use(authCheck);

export const paymentMethods = functions.https.onRequest((req, res) => {
    if (!req.path) {
        req.url = `/${req.url}` // prepend '/' to keep query params if any
    }
    return app(req, res);
});

export const paymentMethodRest = new PaymentMethodsRest(app);

