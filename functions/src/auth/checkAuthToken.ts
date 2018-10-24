import { Request, Response } from "firebase-functions";
import * as admin from 'firebase-admin'; 

export function authCheck(req: Request, res: Response) {
    const idToken = req.header('FIREBASE_AUTH_TOKEN');
    return admin.auth().verifyIdToken(idToken);
}