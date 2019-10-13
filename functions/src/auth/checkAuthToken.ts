import { Request, Response } from "firebase-functions";
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

export async function authCheck(req: Request, res: Response, next: any) {

    let token;

    if (req.method === 'OPTIONS') {
        return next();
    }

    // Check if they were passed in via the request body.
    if (_.has(req, 'headers.token')) {
        token = req.headers.token;
    } else if (_.has(req, 'body.token')) {
        token = req.body.token;
    } else {
        return res.status(500).send('Error: No token present in request!');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.body.uid = decodedToken.uid;
        return next();        
    } catch (error) {
        console.log(error);
        return res.status(500).send('Error: Invalid token!');
    }
}