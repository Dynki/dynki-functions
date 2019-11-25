import { Express, Request, Response, Router } from 'express';
import { firestore, auth } from 'firebase-admin'; 
import { config } from 'firebase-functions';
import * as _ from 'lodash';
import newGuid from '../utils/guid';
import * as sgMail from '@sendgrid/mail';
import { MailData } from '@sendgrid/helpers/classes/mail';

import { DynRestBase } from '../base/restbase';
import { UserRecord } from 'firebase-functions/lib/providers/auth';

interface memberInvite {
    name: string;
    invitee: string;
    inviter: string;
    uid: string;
    status: string;
    domain: string;
    created: Date;
    createdBy: string;
}

export class InviteRest extends DynRestBase {

    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * accept
         */
        this.addAcceptRouter();

    }

    addAcceptRouter() {
        const acceptRouter = Router({ mergeParams: true });

        // Create a group on the domain
        acceptRouter.route('/').post(this.acceptInvite.bind(this));

        this.domainApp.use('/:id/accept', acceptRouter);
    }

    async acceptInvite(req: Request, res: Response) {
        try {

            // Get the invite record.
            const inviteRecord = await firestore()
                .collection('member-invites')
                .doc(req.body.id)
                .get();

            const inviteData = inviteRecord.data();

            const user: UserRecord = req.body.user;

            // Check that the invite is in a pending state.
            if (inviteData.status === 'pending') {

                // Add the user UID to the invite record.
                // Update the status to accepted.
                await firestore().collection('member-invites').doc(req.body.id).update({ 
                    uid: user.uid,
                    status: 'accepted'
                });

                const domainRecord = await firestore()
                    .collection('user-domains')
                    .doc(inviteData.domain)
                    .get();
                
                const userGroupId = domainRecord.data().groups.find(g => g.name === 'Users');

                await firestore()
                    .collection('user-domains')
                    .doc(inviteData.domain)
                    .update({ 
                        users: firestore.FieldValue.arrayUnion(user.uid),
                        members: firestore.FieldValue.arrayUnion({
                            email: user.email,
                            id: newGuid(),
                            memberOf: [userGroupId.id],
                            status: 'Active',
                            uid: user.uid
                        })
                     });

                const claims = <any> user.customClaims;
                const primaryDomain = claims.domainId;
                const currentDomainIds = claims.domainIds ? claims.domainIds : [];
                const roles = [userGroupId.id]

                const domainIds = [...currentDomainIds, inviteData.domain];
                await auth().setCustomUserClaims(user.uid, { domainId: primaryDomain, domainIds, roles });

                res.sendStatus(200);
            } else {
                res.status(401).send();
            }
        } catch (error) {
            console.log(error);
            res.status(500).send({ error: req.body.log });
        }
    }

    async getId(req: Request, res: Response, next, id) {
        req.body.id = id;
        next();
    }

    async post(req: Request, res: Response) {
        try {
            const userAllowed = await this.validateUserIsDomainAdmin(req, req.body.domain);

            if (userAllowed) {
                if (this.requestValid(req)) {
                    const invitees = req.body.invitees;
                    const inviter = req.body.inviter;
                    const teamId = req.body.domain;
                    const teamName = req.body.domainName;
    
                    await this.sendInvites(invitees, inviter, teamId, teamName);
                    res.status(200).send('Success');
                } else {
                    res.status(400).send('Invalid request data');
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation');
            }

        } catch (error) {
            console.log(error);
            res.status(500).send(error);
        }
    }

    requestValid(req: Request) {
        const invitees = req.body.invitees;
        const inviter = req.body.inviter;
        const teamId = req.body.domain;
        const teamName = req.body.domainName;

        return invitees && inviter && teamId && teamName;
    }

    sendInvites(invitees: string[], inviter, teamId, teamName): Promise<any> {
        return Promise.all(
            invitees.map(async (invitee) => {
                const inviteId = newGuid();

                const invite: memberInvite = {
                    name: teamName,
                    invitee,
                    inviter,
                    uid: null,
                    status: 'pending',
                    domain: teamId,
                    created: new Date(),
                    createdBy: inviter
                }
        
                await this.addInviteeRecord(inviteId, invite);
                await this.sendEmail(inviteId, invitee, inviter, teamName);
            })
        );
    }

    async validateUserIsDomainAdmin(req: Request, domainId: string): Promise<boolean> {
        const domainCollection = await firestore()
        .collection('user-domains')
        .where(firestore.FieldPath.documentId(), '==', domainId)
        .where('users', 'array-contains', req.body.hiddenUid)
        .get();

        if (domainCollection && domainCollection.docs.length > 0) {
            const retrievedData = domainCollection.docs[0].data();

            const memberRecord = retrievedData.members.find(m => m.uid === req.body.hiddenUid);
            const adminGroupId = retrievedData.groups.find(g => g.name === 'Administrators');
            const isAnAdmin = memberRecord && memberRecord.memberOf.indexOf(adminGroupId.id) > -1;

            return isAnAdmin;
        } else {
            return false;
        } 
    }

    async addInviteeRecord(inviteId: string, invite: memberInvite): Promise<any> {
        await firestore().collection('member-invites').doc(inviteId).set(invite);
    }

    async sendEmail(inviteId: string, invitee: string, inviter: string, teamName: string) : Promise<any> {

        sgMail.setApiKey(config().sendgrid.emailkey);

        const msg: MailData = {
            to: invitee,
            from: 'invitation-do-not-reply@dynki.com',
            templateId: config().sendgrid.invitetemplate,
            dynamicTemplateData: {
                inviteId,
                invitee,
                inviter,
                teamName
            }
        }

        await sgMail.send(msg);
    }
}
