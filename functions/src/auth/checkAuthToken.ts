import { Request, Response } from "firebase-functions";
import * as admin from 'firebase-admin'; 

export async function authCheck(request: Request, responce: Response, next: Function) {
    try {
        // https://firebase.google.com/docs/reference/admin/node/admin.auth.DecodedIdToken
        const idToken = request.header('FIREBASE_AUTH_TOKEN');
        await admin.auth().verifyIdToken(idToken);
    } catch (error) {
        next(error);
        return;
    }
    next();
}