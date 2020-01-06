import { Express, Request, Response } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';

import { DynRestBase } from '../base/restbase';
import { DomainRequest } from '../base/dynki-request';

import { DomainGroups } from './domain-groups';
import { DomainMembers } from './domain-members';

export class DomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * Groups
         */
        this.setGroupsRouter();

        /**
         * Members
         */
        this.setMembersRouter();
    }

    setGroupsRouter() {
        new DomainGroups(this.domainApp);
    }

    setMembersRouter() {
        new DomainMembers(this.domainApp);
    }

    /**
     * Domain methods
     */

    async get(req: DomainRequest, res: Response) {
        try {
            const { user } = req.body.dynki;

            const domainCollection = await admin.firestore()
                .collection('user-domains').where('users', 'array-contains', user.uid).get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const domains = domainCollection.docs.map(d => {
                    return { id: d.id, display_name: d.data().display_name }
                });

                res.json(domains);
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getId(req: DomainRequest, res: Response, next, id) {
        try {
            const { user } = req.body.dynki;

            const domainCollection = await admin.firestore()
                .collection('user-domains')
                .where(admin.firestore.FieldPath.documentId(), '==', id)
                .where('users', 'array-contains', user.uid)
                .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const retrievedData = domainCollection.docs[0].data();

                const mappedDomain = {
                    id: domainCollection.docs[0].id,
                    display_name: retrievedData.display_name,
                    status: 'Enabled',
                    groups: retrievedData.groups ? retrievedData.groups : [],
                    members: retrievedData.members ? retrievedData.members : []
                }
                
                // This is the item we will expose in the response.
                req.body.dynki.data.domainRecord = mappedDomain;

                // More for internal use within these functions.
                req.body.dynki.data.domainId = domainCollection.docs[0].id;
                req.body.dynki.data.domainRawRecord = domainCollection.docs[0].data();
                next();
                
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnId(req: Request, res: Response) {
        try {
            res.json(req.body.dynki.data.domainRecord);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: DomainRequest, res: Response) {
        try {
            const { displayName, name, email } = req.body;
            const { user } = req.body.dynki;

            const domainCollection = await admin.firestore()
                .collection('user-domains').where('owner', '==', user.uid).get();

            if (domainCollection && domainCollection.docs.length > 0) {
                await admin.firestore()
                    .collection('domains')
                    .doc(domainCollection.docs[0].id)
                    .set({
                        display_name: name
                    });

                await admin.firestore()
                    .collection('user-domains')
                    .doc(domainCollection.docs[0].id)
                    .update({
                        display_name: name
                    });

                await admin.firestore()
                    .collection('domains')
                    .doc(domainCollection.docs[0].id)
                    .collection('users')
                    .doc(user.uid)
                    .set({
                        email,
                        displayName
                    });

                res.json({ id: domainCollection.docs[0].id });
            } else {
                res.status(500).send({ error: { message: 'Unable to location domain record to update' } });
            }

        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
