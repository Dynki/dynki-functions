import { Request, Response } from "firebase-functions";
import * as admin from 'firebase-admin'; 

export function authCheck(req: Request, res: Response) {
    const idToken = req.body.data.uid;
    return admin.auth().verifyIdToken(idToken);
}